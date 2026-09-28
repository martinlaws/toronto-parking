import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  backSlots,
  checkQrSvg,
  frontSlots,
  numberWord,
  PAPER,
  parseCardArgs,
  renderSheet,
  type CardFace,
} from "../scripts/make-cards";

/** Importing the script runs nothing: `main()` is behind an argv check. */

const QR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 41 41"><path d="M4 4.5h7"/></svg>';
const face = (n: number, code = "wren1y"): CardFace => ({ n, code, qrSvg: QR });

describe("parseCardArgs()", () => {
  it("defaults to every board, fronts only, on Letter", () => {
    assert.deepEqual(parseCardArgs([]), {
      file: "boards.local.json",
      qr: "out/qr",
      out: "out/cards",
      boards: [],
      back: false,
      paper: "letter",
      to: "",
    });
  });

  it("takes boards, backs and paper in either flag form", () => {
    const options = parseCardArgs(["--board", "2", "--board=4", "--board", "2", "--back", "--paper=a4"]);
    assert.deepEqual(options.boards, [2, 4]);
    assert.equal(options.back, true);
    assert.equal(options.paper, "a4");
  });

  it("refuses a board outside the four, a paper it does not know and a stray flag", () => {
    assert.throws(() => parseCardArgs(["--board", "5"]));
    assert.throws(() => parseCardArgs(["--board", "0"]));
    assert.throws(() => parseCardArgs(["--paper", "legal"]));
    assert.throws(() => parseCardArgs(["--board"]));
    assert.throws(() => parseCardArgs(["--name"]));
  });
});

describe("--to", () => {
  it("addresses exactly one card", () => {
    assert.equal(parseCardArgs(["--board", "2", "--to", " Wren "]).to, "Wren");
    assert.throws(() => parseCardArgs(["--to", "Wren"]));
    assert.throws(() => parseCardArgs(["--board", "1", "--board", "2", "--to=Wren"]));
    assert.throws(() => parseCardArgs(["--board", "2", "--to"]));
  });

  it("prints the line only when asked, escaped", () => {
    assert.doesNotMatch(renderSheet([face(2)], { back: false, paper: "letter" }), /class="to"/);
    const html = renderSheet([{ ...face(2), to: "Wren & <Co>" }], { back: false, paper: "letter" });
    assert.match(html, /<p class="to">To Wren &amp; &lt;Co&gt;<\/p>/);
  });
});

describe("slots", () => {
  it("centres a lone card on the page", () => {
    const [slot] = frontSlots(1, "letter");
    assert.ok(Math.abs(slot.x + 74 / 2 - PAPER.letter.w / 2) < 1e-9);
    assert.ok(Math.abs(slot.y + 105 / 2 - PAPER.letter.h / 2) < 1e-9);
  });

  it("keeps four cards and their crop marks on both papers", () => {
    for (const paper of ["letter", "a4"] as const) {
      for (const { x, y } of frontSlots(4, paper)) {
        assert.ok(x - 7 >= 5 && y - 7 >= 5, `${paper} marks clear the printer margin`);
        assert.ok(x + 74 + 7 <= PAPER[paper].w - 5 && y + 105 + 7 <= PAPER[paper].h - 5);
      }
    }
  });

  it("mirrors the backs left to right for a long-edge flip", () => {
    const fronts = frontSlots(4, "letter");
    const backs = backSlots(fronts, "letter");
    assert.ok(Math.abs(backs[0].x - fronts[1].x) < 1e-9);
    assert.ok(Math.abs(backs[1].x - fronts[0].x) < 1e-9);
    assert.deepEqual(
      backs.map((slot) => slot.y),
      fronts.map((slot) => slot.y),
    );
  });
});

describe("renderSheet()", () => {
  it("prints the code, the domain and the QR at 49 mm on an A7 card", () => {
    const html = renderSheet([face(2)], { back: false, paper: "letter" });
    assert.match(html, /<span class="cv">wren1y<\/span>/);
    assert.match(html, /<p class="url">cars\.mlaws\.ca<\/p>/);
    assert.match(html, /\.qrwrap\{width:49mm;height:49mm/);
    assert.match(html, /\.card\{position:absolute;width:74mm;height:105mm\}/);
    assert.match(html, /@page\{size:letter;margin:0\}/);
    assert.ok(html.includes(QR));
  });

  it("adds a second page of backs only when asked, numbered in words", () => {
    const fronts = renderSheet([face(2)], { back: false, paper: "letter" });
    assert.equal(fronts.match(/class="sheet"/g)?.length, 1);
    assert.doesNotMatch(fronts, /Board two/);

    const both = renderSheet([face(2)], { back: true, paper: "letter" });
    assert.equal(both.match(/class="sheet"/g)?.length, 2);
    assert.match(both, /Board two of four/);
  });

  it("holds one to four cards", () => {
    assert.throws(() => renderSheet([], { back: false, paper: "letter" }));
    assert.throws(() => renderSheet([1, 2, 3, 4, 1].map((n) => face(n)), { back: false, paper: "letter" }));
  });

  it("follows the repo's copy rules", () => {
    const html = renderSheet([1, 2, 3, 4].map((n) => face(n)), { back: true, paper: "letter" });
    const text = html.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<[^>]+>/g, " ");
    assert.doesNotMatch(text, /!/);
    assert.doesNotMatch(text, /Rush Hour|Marty|fortnight/i);
  });
});

describe("helpers", () => {
  it("names the four boards", () => {
    assert.deepEqual([1, 2, 3, 4].map(numberWord), ["one", "two", "three", "four"]);
    assert.throws(() => numberWord(5));
  });

  it("accepts the QR make-qr writes and nothing with a script in it", () => {
    assert.equal(checkQrSvg(`  ${QR}\n`), QR);
    assert.throws(() => checkQrSvg("<html></html>"));
    assert.throws(() => checkQrSvg('<svg onload="x()"></svg>'));
    assert.throws(() => checkQrSvg("<svg><script>x()</script></svg>"));
  });
});
