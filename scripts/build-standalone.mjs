#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const file=relative=>path.join(root,relative);
const htmlPath=file("key-lens-final.html");
const registrySource=fs.readFileSync(file("hint-registry.js"),"utf8");
const engineSource=fs.readFileSync(file("hint-engine.js"),"utf8");
const cssSource=fs.readFileSync(file("hint-protocol.css"),"utf8");
const sandbox={window:{}};vm.createContext(sandbox);new vm.Script(registrySource).runInContext(sandbox);
const patterns=Object.fromEntries(
  Object.values(sandbox.window.KEY_LENS_HINT_REGISTRY)
    .filter(node=>node.enabled&&node.implementation==="COMPLETE")
    .map(node=>[node.id,fs.readFileSync(file(`hint-nodes/${node.id}.patt`),"utf8")])
);
const safeScript=source=>source.replaceAll("</script","<\\/script");
const cssBlock=`<!-- KEY_LENS_HINT_CSS_START -->
<style data-key-lens-hint-bundle="css">
${cssSource.trim()}
</style>
<!-- KEY_LENS_HINT_CSS_END -->`;
const runtimeBlock=`<!-- KEY_LENS_HINT_RUNTIME_START -->
<script data-key-lens-hint-bundle="registry">
${safeScript(registrySource.trim())}
</script>
<script data-key-lens-hint-bundle="patterns">
window.KEY_LENS_HINT_PATTERNS=Object.freeze(${safeScript(JSON.stringify(patterns))});
</script>
<script data-key-lens-hint-bundle="engine">
${safeScript(engineSource.trim())}
</script>
<!-- KEY_LENS_HINT_RUNTIME_END -->`;
let html=fs.readFileSync(htmlPath,"utf8");
const cssPattern=/<!-- KEY_LENS_HINT_CSS_START -->[\s\S]*?<!-- KEY_LENS_HINT_CSS_END -->/;
const runtimePattern=/<!-- KEY_LENS_HINT_RUNTIME_START -->[\s\S]*?<!-- KEY_LENS_HINT_RUNTIME_END -->/;
if(!cssPattern.test(html)||!runtimePattern.test(html))throw new Error("HINT bundle anchors are missing from key-lens-final.html");
html=html.replace(cssPattern,cssBlock).replace(runtimePattern,runtimeBlock);
fs.writeFileSync(htmlPath,html.endsWith("\n")?html:`${html}\n`);
console.log(`Built standalone key-lens-final.html with ${Object.keys(patterns).length} embedded HINT patterns`);
