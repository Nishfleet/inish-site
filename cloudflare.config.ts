import { bindings, defineConfig, triggers } from "cf/config";

export default defineConfig({
	worker: {
		name: "inish-site",
		compatibilityDate: "2026-08-01",
		entrypoint: "worker.js",
		workersDev: false,
		previewUrls: true,
		observability: {
			enabled: true,
		},
		assets: {
			htmlHandling: "none",
			runWorkerFirst: ["/*"],
		},
		triggers: [
			triggers.fetch({ pattern: "nish.sh/daily", zone: "nish.sh" }),
			triggers.fetch({ pattern: "nish.sh/daily/*", zone: "nish.sh" }),
			triggers.fetch({ pattern: "inish.in", zone: "inish.in" }),
			triggers.fetch({ pattern: "inish.in/*", zone: "inish.in" }),
			triggers.fetch({ pattern: "www.inish.in", zone: "inish.in" }),
			triggers.fetch({ pattern: "www.inish.in/*", zone: "inish.in" }),
		],
		env: {
			ASSETS: bindings.assets(),
		},
	},
});
