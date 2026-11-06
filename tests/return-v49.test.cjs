const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("All Owlbear V4.9 entry points lead back to the compact Archives", () => {
  const manifest = JSON.parse(read("manifest-v49.json"));
  assert.equal(manifest.version, "4.9.0");
  assert.match(manifest.background_url, /\/background-v49\.html$/);
  assert.match(manifest.action.popover, /\/index-v49\.html$/);
  assert.match(read("background-v49.html"), /src\/v49\/background\.mjs/);
  const background = read("src/v49/background.mjs");
  assert.match(background, /return-v49\.html/);
  assert.match(background, /invite-v49\.html/);
  assert.match(background, /p\.role==="GM"&&p\.connectionId===event\.connectionId/);

  for (const page of ["index", "return", "invite"]) {
    assert.match(read(page + "-v49.html"), /target="archives-main"\s+href="https:\/\/toniogervais\.github\.io\/archives-owlbear\/archives-app-v58-v49\.html"/);
  }
  assert.match(read("src/v49/return-link.mjs"), /link\.href\+="\?resume=1"/);
});

test("Returning focuses the open Archives tab without reloading its Live session", async () => {
  const { focusArchives } = await import("../src/v41/focus-archives.mjs");
  const url = "https://toniogervais.github.io/archives-owlbear/archives-app-v58-v49.html";
  let focused = false;
  const tab = {
    location: {
      href: url,
      replace() { assert.fail("The Archives tab must stay loaded"); }
    },
    focus() { focused = true; }
  };

  assert.equal(focusArchives(url + "?resume=1", (href, name) => {
    assert.equal(href, "");
    assert.equal(name, "archives-main");
    return tab;
  }), true);
  assert.equal(focused, true);
});
