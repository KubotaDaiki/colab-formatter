import { loadPyodide, PyodideInterface } from "pyodide";

class Pyodide {
  pyodide: PyodideInterface | undefined;

  async init() {
    const pyodide = await loadPyodide({
      indexURL: "./pyodide",
    });
    await pyodide.loadPackage("micropip", { checkIntegrity: false });
    await pyodide.runPythonAsync(`
      import micropip
      await micropip.install("./wheel/black-23.12.1-py3-none-any.whl")
      import black
    `);
    this.pyodide = pyodide;
  }

  async formatCode(code: string) {
    const preprocessedCode = this.preprocessing(code)

    // 直接フォーマットするとエスケープ文字等が含まれている場合にエラーが発生するため、
    // 一度ファイルに書き出してからフォーマットしている
    this.pyodide!.FS.writeFile("./tmp.py", preprocessedCode, {
      encoding: "utf8",
    });
    const formattedCode = await this.pyodide!.runPythonAsync(`
      with open("./tmp.py", "r") as f:
          data = f.read()
      code = black.format_str(data, mode=black.Mode())
      code
    `);

    return this.postprocessing(formattedCode)
  }

  preprocessing(code: string) {
    // ノーブレークスペースがあるとフォーマットが正しくできないので通常の半角スペースに変換する
    let preprocessedCode = code.replace(/\xA0/g, " ")
    return preprocessedCode
  }

  postprocessing(code: string) {
    // 最後の改行はノートブックにおいては必要ないので削除
    let postProcessedCode = code.replace(/\n$/, "");
    return postProcessedCode
  }
}

let pyodideClass: Pyodide | undefined;

// backgroundからメッセージが送られてくると、以下の関数が実行されフォーマットされる
chrome.runtime.onMessage.addListener((request, _sender, callback) => {
  (async () => {
    try {
      if (!pyodideClass) {
        // フォーマット毎にpyodideを初期化するとレスポンスが非常に悪くなるため、
        // 最初だけ定義・初期化をしている
        pyodideClass = new Pyodide();
        await pyodideClass.init();
      }

      const formattedCode = await pyodideClass.formatCode(request.code)
      callback({ status: "success", code: formattedCode });
    } catch (e: any) {
      console.log(e.message);
      callback({ status: "error", code: request.code });
    }
  })();
  return true;
});
