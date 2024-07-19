// コードフォーマット用のoffscreenを作成
chrome.offscreen.createDocument({
  url: "offscreen.html",
  reasons: [chrome.offscreen.Reason.IFRAME_SCRIPTING],
  justification: "reason for needing the document",
});

// ショートカットキー入力時に以下の関数が実行される
chrome.commands.onCommand.addListener((commands, tab) => {
  if (commands === "format") {
    (async function () {
      // フォーマットをする必要が無いサイトでは以降の処理をスキップ
      const permittedUrl = ["https://colab.research.google.com/", "https://www.kaggle.com/"]
      const isPermitted = permittedUrl.some((url) => { return tab.url?.indexOf(url) === 0; });
      if (!isPermitted) {
        return;
      }
      const tabId = tab.id!

      // コードをフォーマットしてセルに書き込む
      const code = await readCode(tabId)
      const formattedCode = await formatCode(code);
      await writeCode(tabId, formattedCode);
    })();
  }
});

async function readCode(tabId: number) {
  const code = await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      const codeElement = document.querySelector<HTMLTextAreaElement>(".cell.code.focused textarea")!

      const ua = window.navigator.userAgent.toLowerCase();
      const modifierKey = { "ctrlKey": true, "metaKey": false }
      if (ua.indexOf("mac os x") !== -1) {
        modifierKey["ctrlKey"] = false;
        modifierKey["metaKey"] = true;
      }
      const allSelectEvent = new KeyboardEvent("keydown", { ...modifierKey, bubbles: true, keyCode: 65 })
      codeElement.dispatchEvent(allSelectEvent); // デフォルトだと全てのコードが取得できないため、全選択のイベントをを発火させている

      // copyイベントを意図的に発火させ、コードを取得する
      const dataTransfer = new DataTransfer();
      codeElement.dispatchEvent(new ClipboardEvent("copy", { clipboardData: dataTransfer }));
      const code = dataTransfer.getData("text/plain")

      return code;
    },
  });
  return code[0].result!;
}

async function formatCode(code: string) {
  const response = await chrome.runtime.sendMessage({ code: code }); // offscreenにコードを送り、フォーマットする
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

async function writeCode(tabId: number, code: string) {
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: async (code) => {
      const codeElement = document.querySelector<HTMLTextAreaElement>(".cell.code.focused textarea")!;
      // pasteイベントを意図的に発火させ、コードをセルに書き込む
      // このやり方ではクリップボードのデータが使用できないため、DataTransfer経由でコードを渡している
      const dataTransfer = new DataTransfer();
      dataTransfer.setData("text/plain", code);
      codeElement.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dataTransfer }));
    },
    args: [code]
  });
}