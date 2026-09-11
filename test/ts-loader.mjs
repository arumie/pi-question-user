import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export async function resolve(specifier, context, nextResolve) {
	if (specifier.startsWith(".") && specifier.endsWith(".js")) {
		const tsSpecifier = `${specifier.slice(0, -3)}.ts`;
		try {
			await access(fileURLToPath(new URL(tsSpecifier, context.parentURL)));
			return nextResolve(tsSpecifier, context);
		} catch {
			// Let Node report the original resolution error for non-source .js imports.
		}
	}
	return nextResolve(specifier, context);
}
