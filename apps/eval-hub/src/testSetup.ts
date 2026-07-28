import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const script = ["#!/bin/sh", 'if [ "$1" = "--version" ]; then echo test-goose; exit 0; fi', "exit 0", ""].join("\n");
for (const name of ["goose", "goose-test", "eval-hub-test-goose"]) {
  const testBin = path.join(os.tmpdir(), name);
  if (!fs.existsSync(testBin) || fs.readFileSync(testBin, "utf8") !== script) {
    fs.writeFileSync(testBin, script, { mode: 0o755 });
  }
}
const current = process.env["PATH"] ?? "";
if (!current.split(path.delimiter).includes(os.tmpdir())) {
  process.env["PATH"] = os.tmpdir() + path.delimiter + current;
}