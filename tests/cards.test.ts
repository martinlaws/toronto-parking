import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  backSlots,
  checkQrSvg,
  frontSlots,
  numberWord,
  FOLD_MARGIN,
  foldGeometry,
  PAPER,
  parseCardArgs,
  renderFoldSheet,
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
      from: "",
      fold: "none",
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

describe("--from", () => {
  it("replaces the title only when asked", () => {
    assert.equal(parseCardArgs(["--from", " Wren "]).from, "Wren");
    assert.match(renderSheet([face(2)], { back: false, paper: "letter" }), /<p class="pk">Toronto Parking<\/p>/);
    const html = renderSheet([{ ...face(2), from: "Wren" }], { back: false, paper: "letter" });
    assert.match(html, /<p class="pk">From Wren<\/p>/);
    assert.doesNotMatch(html, />Toronto Parking</);
  });
});

describe("--fold", () => {
  it("fits the card inside the margin of every panel, never shorter than A7", () => {
    for (const paper of ["letter", "a4"] as const) {
      for (const fold of ["half", "quarter"] as const) {
        const { sheet, panel, scale, cardH, inset } = foldGeometry(paper, fold);
        assert.equal(panel.w * 2, sheet.w);
        assert.equal(panel.h * (fold === "half" ? 1 : 2), sheet.h);
        assert.ok(inset.x >= FOLD_MARGIN - 1e-9 && inset.y === FOLD_MARGIN);
        assert.ok(74 * scale + 2 * inset.x <= panel.w + 1e-9);
        assert.ok(Math.abs(cardH * scale - (panel.h - 2 * FOLD_MARGIN)) < 1e-9);
        assert.ok(cardH >= 105 - 1e-9, `${paper} ${fold}: the panel is never shorter than the A7 card`);
      }
    }
  });

  it("puts a quarter fold's back and front on the bottom half of an upright sheet", () => {
    const g = foldGeometry("letter", "quarter");
    assert.deepEqual([g.sheet.w, g.sheet.h], [215.9, 279.4]);
    assert.deepEqual(g.back, { x: 0, y: 139.7 });
    assert.deepEqual(g.front, { x: 107.95, y: 139.7 });
    const html = renderFoldSheet([face(2)], "letter", "quarter");
    assert.match(html, /@page\{size:letter;margin:0\}/);
    assert.ok(html.indexOf('class="card back"') < html.indexOf('class="card front"'));
  });

  it("puts the back on the left and the front on the right, one sheet a card", () => {
    const html = renderFoldSheet([face(2), face(3)], "letter");
    assert.match(html, /@page\{size:letter landscape;margin:0\}/);
    assert.equal(html.match(/class="sheet"/g)?.length, 2);
    const first = html.slice(html.indexOf('class="sheet"'), html.indexOf('class="sheet"', html.indexOf('class="sheet"') + 1));
    assert.ok(first.indexOf('class="card back"') < first.indexOf('class="card front"'));
    assert.match(first, /class="panel" style="left:8mm;top:8mm;/);
    assert.match(first, /class="panel" style="left:147.7mm;top:8mm;/);
    assert.doesNotMatch(html, /class="marks"/);
  });

  it("parses", () => {
    assert.equal(parseCardArgs(["--fold"]).fold, "half");
    assert.equal(parseCardArgs(["--fold=quarter"]).fold, "quarter");
    assert.equal(parseCardArgs(["--fold", "quarter"]).fold, "quarter");
    assert.throws(() => parseCardArgs(["--fold=thirds"]));
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
