// offscreenの作成
chrome.offscreen.createDocument({
  url: "offscreen.html",
  reasons: [chrome.offscreen.Reason.IFRAME_SCRIPTING],
  justification: "reason for needing the document",
});

const ctrl = 2;
const command = 4;
const shift = 8;

const paste = {
  type: "keyDown",
  windowsVirtualKeyCode: 86,
  modifiers: ctrl,
};
const copy = {
  type: "keyDown",
  windowsVirtualKeyCode: 67,
  modifiers: ctrl,
};
const deleteKey = {
  type: "keyDown",
  windowsVirtualKeyCode: 8,
};
const selectIndent = {
  type: "keyDown",
  windowsVirtualKeyCode: 36,
  modifiers: shift,
};

chrome.commands.onCommand.addListener((commands, tab) => {
  if (commands == "format") {
    (async function () {
      // 特定ののサイト以外は以降の処理をスキップ
      if (
        tab.url?.indexOf("https://colab.research.google.com/") &&
        tab.url.indexOf("https://www.kaggle.com/")
      ) {
        return;
      }
      // OSの判別
      const os = (await chrome.runtime.getPlatformInfo()).os;

      const modifiers = os == "mac" ? command : ctrl; //OSによって修飾キーを変える

      const allSelect = {
        type: "keyDown",
        windowsVirtualKeyCode: 65,
        modifiers: modifiers,
      };

      await chrome.debugger.attach({ tabId: tab.id }, "1.3"); // デバッガをアタッチ

      await pressKey(tab.id, allSelect);

      let code;
      if (os == "mac") {
        code = await copyCodeMac(tab.id);
      } else {
        code = await copyCode(tab.id);
      }

      let formattedCode = await formatCode(code);

      if (os == "mac") {
        await pasteCodeMac(tab.id, code, formattedCode);
      } else {
        await pasteCode(tab.id, formattedCode);
      }

      await chrome.debugger.detach({ tabId: tab.id }); // デバッガをデタッチ
    })();
  }
});

/**
 * テキストをペーストする
 *
 * @param {*} tabId ペースト先のタブ
 * @param {*} text ペーストするテキスト
 */
async function pasteCode(tabId: any, text: any) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (text) => {
      navigator.clipboard.writeText(text);
    },
    args: [text],
  });

  await pressKey(tabId, paste);
}

/**
 * テキストをペーストする（Mac用）
 *
 * @param {*} tabId ペースト先のタブ
 * @param {*} code フォーマット前のコード
 * @param {*} formattedCode フォーマット後のコード
 */
async function pasteCodeMac(tabId: any, code: any, formattedCode: any) {
  // フォーマット前のコードをクリップボードに書き込み
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: (code) => {
      navigator.clipboard.writeText(code);
    },
    args: [code[0].result.replace(/\xA0/g, " ")],
  });

  //　コードを改行で分割
  let splitCode = formattedCode.split(/(?<=\r\n|\n)/);

  await insertText(tabId, splitCode[0]);
  for (let i = 1; i < splitCode.length; i++) {
    // 前の行にインデントがある場合は、自動インデントを削除する
    if (splitCode[i - 1].indexOf(" ") == 0) {
      await pressKey(tabId, selectIndent);
      await pressKey(tabId, deleteKey);
    }

    await insertText(tabId, splitCode[i]);
  }
}

/**
 * offscreenにコードを送り、フォーマットする
 *
 * @param {*} code フォーマットするコード
 * @return {*} フォーマット済みのコード
 */
async function formatCode(code: any) {
  const response = await chrome.runtime.sendMessage({ code: code[0].result });
  if (response.status === "error") {
    chrome.notifications.create("", {
      title: "colab-formatter",
      message: "エラーによりフォーマット出来ませんでした",
      iconUrl: chrome.runtime.getURL("icon48.png"),
      type: "basic",
    });
  }
  return response.code;
}

/**
 * テキストをコピーする
 *
 * @param {*} tabId コピー元のタブID
 * @return {*} コピーしたテキスト
 */
async function copyCode(tabId: any) {
  await pressKey(tabId, copy);
  const text = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: async () => {
      return await navigator.clipboard.readText();
    },
  });
  return text;
}

/**
 * テキストをペーストする（Mac用）
 *
 * @param {*} tabId コピー元のタブID
 * @return {*} コピーしたテキスト
 */
async function copyCodeMac(tabId: any) {
  const code = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      const code = [
        ...document.querySelectorAll<HTMLElement>(
          ".cell.code.focused .view-line"
        ),
      ];
      let combinedCode = "";

      code.sort(function (first, second) {
        const firstStyleTop = Number(first.style.top.replace("px", ""));
        const secondStyleTop = Number(second.style.top.replace("px", ""));
        return firstStyleTop - secondStyleTop;
      });

      code.forEach((line) => {
        const lineChildren = [...line.children[0].children];
        let combinedLine = "";
        lineChildren.forEach((child) => {
          combinedLine += child.textContent;
        });
        combinedCode += combinedLine + "\n";
      });
      return combinedCode;
    },
  });
  return code;
}

/**
 * キーを押す動作をエミュレートする
 *
 * @param {*} tabId キーを押す先のタブID
 * @param {*} key 押すキー
 */
async function pressKey(tabId: any, key: any) {
  await chrome.debugger.sendCommand(
    { tabId: tabId },
    "Input.dispatchKeyEvent",
    key
  );
}

/**
 * テキストを挿入する
 *
 * @param {*} tabId 挿入先のタブID
 * @param {*} text 挿入するテキスト
 */
async function insertText(tabId: any, text: any) {
  await chrome.debugger.sendCommand({ tabId: tabId }, "Input.insertText", {
    text: text,
  });
}
