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

      // コードフォーマット用のoffscreenをセットアップ
      await setupOffscreenDocument("src/offscreen.html")

      // コードをフォーマットしてセルに書き込む
      const code = await readCode(tabId)
      const formattedCode = await formatCode(code);
      await writeCode(tabId, formattedCode);
    })();
  }
});

/**
 * フォーカス中のセルのコードを読み取る
 * @param tabId 読み取り先のタブID
 * @returns 読み取ったコード
 */
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

/**
 * コードをフォーマットする
 * @param code フォーマットするコード
 * @returns フォーマット後のコード
 */
async function formatCode(code: string) {
  const response = await chrome.runtime.sendMessage({ code: code }); // offscreenにコードを送り、フォーマットする
  if (response.status === "error") {
    chrome.notifications.create("", {
      title: "colab-formatter",
      message: "エラーによりフォーマット出来ませんでした",
      iconUrl: chrome.runtime.getURL("assets/icon48.png"),
      type: "basic",
    });
  }
  return response.code;
}

/**
 * フォーカス中のセルにコードを書き込む
 * @param tabId 書き込み先のタブID
 * @param code 書き込むコード
 */
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


let creating: any;
/**
 * 既存のオフスクリーンを検索し、存在しない場合は新規作成する
 * @param path オフスクリーンのパス
 * @returns
 */
async function setupOffscreenDocument(path: string) {
  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: [chrome.offscreen.Reason.IFRAME_SCRIPTING],
      justification: 'reason for needing the document',
    });
    await creating;
    creating = null;
  }
}