import type * as vite from 'vite';
import type { ModuleLoader, ModuleLoaderEventEmitter } from './loader';
import { EventEmitter } from 'events';

export function createViteLoader(viteServer: vite.ViteDevServer): ModuleLoader {
	const events = new EventEmitter() as ModuleLoaderEventEmitter;

	viteServer.watcher.on('add', (...args) => events.emit('file-add', args));
	viteServer.watcher.on('unlink', (...args) => events.emit('file-unlink', args));
	viteServer.watcher.on('change', (...args) => events.emit('file-change', args));

	wrapMethod(viteServer.ws, 'send', msg => {
		if(msg?.type === 'error') {
			events.emit('hmr-error', msg);
		}
	});

	return {
		import(src) {
			return viteServer.ssrLoadModule(src);
		},
		async resolveId(spec, parent) {
			const ret = await viteServer.pluginContainer.resolveId(spec, parent);
			return ret?.id;
		},
		getModuleById(id) {
			return viteServer.moduleGraph.getModuleById(id);
		},
		getModulesByFile(file) {
			return viteServer.moduleGraph.getModulesByFile(file);
		},
		getModuleInfo(id) {
			return viteServer.pluginContainer.getModuleInfo(id);
		},
		fixStacktrace(err) {
			return viteServer.ssrFixStacktrace(err);
		},
		clientReload() {
			viteServer.ws.send({
				type: 'full-reload',
				path: '*'
			});
		},
		webSocketSend(msg) {
			return viteServer.ws.send(msg);
		},
		isHttps() {
			return !!viteServer.config.server.https;
		},
		events
	};
}


function wrapMethod(object: any, method: string, newFn: (...args: any[]) => void) {
	const orig = object[method];
	object[method] = function(...args: any[]) {
		newFn.apply(this, args);
		return orig.apply(this, args);
	};
}
