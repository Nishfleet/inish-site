import { defineWranglerConfig } from "wrangler/experimental-config";

export default defineWranglerConfig({
	dev: {
		upstreamProtocol: "https",
	},
	assetsDirectory: "./dist",
});
