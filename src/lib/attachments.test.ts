// src/lib/attachments.test.ts
import assert from "node:assert/strict";
import { test } from "vitest";
import {
  attachmentLink,
  extForMime,
  fitWithin,
  isImagePath,
  isReservedFolderName,
  mimeOf,
  ownImagesIn,
  reencodeMime,
  relinkAttachments,
  resolveAttachment,
  unusedImages,
} from "./attachments";
import { extOf } from "./paths";

test("attachment links", () => {
  // ── attachmentLink ──
  assert.equal(attachmentLink(null, "a.png"), "attachments/a.png");
  assert.equal(attachmentLink("Notes", "a.png"), "../attachments/a.png");
  assert.equal(
    attachmentLink("Notes/boop", "a.png"),
    "../../attachments/a.png",
  );

  // ── resolveAttachment ──
  const vault = "C:\\Users\\me\\vault\\";
  assert.equal(
    resolveAttachment(vault, "../../attachments/a.png"),
    "C:/Users/me/vault/attachments/a.png",
  );
  assert.equal(
    resolveAttachment(vault, "attachments/a%20b.png"),
    "C:/Users/me/vault/attachments/a b.png",
  );
  // a stale "../" count still resolves
  assert.equal(
    resolveAttachment("/v", "../../../../attachments/x.webp"),
    "/v/attachments/x.webp",
  );
  assert.equal(
    resolveAttachment(vault, "https://example.com/attachments/a.png"),
    null,
  );
  assert.equal(resolveAttachment(vault, "data:image/png;base64,AAAA"), null);
  assert.equal(resolveAttachment(vault, "../pictures/a.png"), null);
  assert.equal(resolveAttachment(vault, "../my-attachments/a.png"), null);
  assert.equal(resolveAttachment(vault, "attachments/sub/a.png"), null); // only the folder itself

  // ── relinkAttachments ──
  const body =
    "x ![](../attachments/a.png) y ![](../attachments/b.png)\n[site](https://a.b/attachments/c.png) [n](other.md)";
  // moving one level deeper: Notes -> Notes/boop
  assert.equal(
    relinkAttachments(body, "Notes", "Notes/boop"),
    "x ![](../../attachments/a.png) y ![](../../attachments/b.png)\n[site](https://a.b/attachments/c.png) [n](other.md)",
  );
  // out to the vault root
  assert.equal(
    relinkAttachments("![](../attachments/a.png)", "Notes", null),
    "![](attachments/a.png)",
  );
  // from the root into a folder
  assert.equal(
    relinkAttachments("![](attachments/a.png)", null, "A/B/C"),
    "![](../../../attachments/a.png)",
  );
  // same depth: untouched
  assert.equal(relinkAttachments(body, "Notes", "Work"), body);
  // no links: untouched
  assert.equal(relinkAttachments("plain", "A", null), "plain");

  // ── small helpers ──
  assert.equal(extOf("a/b/photo.PNG"), "png");
  assert.equal(extOf("noext"), "");
  assert.ok(
    isImagePath("C:\\x\\a.JPG") && isImagePath("a.svg") && !isImagePath("a.md"),
  );
  assert.equal(mimeOf("a.jpeg"), "image/jpeg");
  assert.equal(extForMime("image/jpeg"), "jpg");
  assert.equal(extForMime("image/svg+xml"), "svg");
  assert.equal(extForMime("image/bmp"), null);
  assert.ok(isReservedFolderName(" Attachments ", null));
  assert.ok(!isReservedFolderName("attachments", "Notes"));
  assert.ok(!isReservedFolderName("pictures", null));
});

test("unused images", () => {
  const files = [
    "aBcDeFgHiJ.png", // used by a markdown link
    "k1k2k3k4k5.jpg", // used by a wiki embed, written in another case
    "u_n-u_s-ed.webp", // unused, ours
    "diagram final.png", // hand-placed, never ours
    "notes_pdf.pdf", // not an image
    "short.png", // not 10 characters
    "ZZZZZZZZZZ.svg", // unused, ours
    "mmmmmmmmmm.jpeg", // unused, ours (a dropped .jpeg)
  ];

  const notes = [
    "# a\n![x](../attachments/aBcDeFgHiJ.png)\n",
    "![[K1K2K3K4K5.JPG]]",
    "[ref]: ../../attachments/ndsfsdfsdf.png",
  ].join("\n");

  assert.deepEqual(unusedImages(files, notes), [
    "u_n-u_s-ed.webp",
    "ZZZZZZZZZZ.svg",
    "mmmmmmmmmm.jpeg",
  ]);

  // A link inside a code block still protects its picture
  assert.deepEqual(
    unusedImages(
      ["aBcDeFgHiJ.png"],
      "```\n![](attachments/aBcDeFgHiJ.png)\n```",
    ),
    [],
  );
  // Nothing to look at
  assert.deepEqual(unusedImages([], "x"), []);
  // No notes at all: every one of ours is unused, hand-placed files still stay
  assert.deepEqual(unusedImages(["aBcDeFgHiJ.png", "diagram final.png"], ""), [
    "aBcDeFgHiJ.png",
  ]);
});

test("ownImagesIn lists the pictures a note leaves behind, once each", () => {
  const text = [
    "![a](../attachments/aBcDeFgHiJ.png) and again ![](attachments/aBcDeFgHiJ.png)",
    '![t](../../attachments/u_n-u_s-ed.webp "a title")',
    "[ref]: ../attachments/ZZZZZZZZZZ.svg",
    "![no](https://example.com/attachments/photo.png)",
    "![hand](../attachments/diagram final.png)",
    "![odd](../attachments/%E9%.png)",
    "![not a picture](../attachments/aBcDeFgHiJ.pdf)",
  ].join("\n");
  assert.deepEqual(ownImagesIn(text), [
    "aBcDeFgHiJ.png",
    "u_n-u_s-ed.webp",
    "ZZZZZZZZZZ.svg",
  ]);
  assert.deepEqual(ownImagesIn("no pictures here"), []);
  // A picture another note still links is not unused: what the sweep does with the candidates
  const mine = ownImagesIn(
    "![](attachments/aBcDeFgHiJ.png) ![](attachments/kLmNoPqRsT.png)",
  );
  assert.deepEqual(unusedImages(mine, "see attachments/aBcDeFgHiJ.png"), [
    "kLmNoPqRsT.png",
  ]);
});

test("scaling a picture down", () => {
  // longer side over the limit: scaled to it, aspect kept
  assert.deepEqual(fitWithin(4000, 3000, 2000), { width: 2000, height: 1500 });
  assert.deepEqual(fitWithin(3000, 4000, 2000), { width: 1500, height: 2000 });
  assert.deepEqual(fitWithin(2001, 2001, 2000), { width: 2000, height: 2000 });
  assert.deepEqual(fitWithin(3840, 2160, 2000), { width: 2000, height: 1125 });
  // at or under the limit: never enlarged, never touched
  assert.deepEqual(fitWithin(2000, 1000, 2000), { width: 2000, height: 1000 });
  assert.deepEqual(fitWithin(640, 480, 2000), { width: 640, height: 480 });
  // a very thin strip keeps at least one pixel
  assert.deepEqual(fitWithin(20000, 3, 2000), { width: 2000, height: 1 });

  // only the stills are re-encoded, in their own type
  assert.equal(reencodeMime("png"), "image/png");
  assert.equal(reencodeMime("jpg"), "image/jpeg");
  assert.equal(reencodeMime("JPEG"), "image/jpeg");
  assert.equal(reencodeMime("webp"), "image/webp");
  assert.equal(reencodeMime("gif"), null);
  assert.equal(reencodeMime("svg"), null);
  assert.equal(reencodeMime("bmp"), null);
});
