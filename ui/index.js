const colorMap = {
  0: "red",
  0.25: "orange",
  0.5: "yellow",
  0.75: "lightgreen",
  0.98: "lightblue",
};

window.onload = () => {
  console.log("UI loaded");
  const inputEl = document.getElementById("prompt");
  const maxInputEl = document.getElementById("max");
  const buttonEl = document.getElementById("button");
  const stateEl = document.getElementById("state");
  const infoEl = document.getElementById("info");

  let prompt = "";
  inputEl.addEventListener("input", () => {
    prompt = inputEl.value;
  });

  let maxTokens = 100;
  maxInputEl.addEventListener("input", () => {
    maxTokens = maxInputEl.value;
  });

  buttonEl.addEventListener("click", async () => {
    stateEl.innerHTML = "";
    const tokenEl = document.createElement("span");
    tokenEl.textContent = prompt;
    stateEl.appendChild(tokenEl);
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt,
        max_tokens: parseInt(maxTokens),
      }),
    });
    if (!response.ok) {
      console.error("Error:", response.statusText);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const text = decoder.decode(value);
      const data = JSON.parse(text);
      console.log(data);
      const token = data.token;
      const confidence = data.confidence;
      const allTokens = data.all_tokens;
      const allConfidences = data.all_confidences;
      const isStop = data.stop;

      const textColor = Object.entries(colorMap).reduce(
        (acc, [threshold, color]) => {
          if (confidence >= parseFloat(threshold)) {
            return color;
          }
          return acc;
        },
        "",
      );

      const tokenEl = document.createElement("span");
      tokenEl.textContent = isStop ? "DONE" : token;
      tokenEl.style.backgroundColor = textColor;
      stateEl.appendChild(tokenEl);

      tokenEl.addEventListener("click", () => {
        const otherTokens = allTokens.map((t, i) => {
          const c = allConfidences[i].toFixed(2);
          return `{"${t.replace("\n", "\\n")}": ${c}}`;
        });
        const info =
          '"' +
          token.replace("\n", "\\n") +
          '": ' +
          confidence.toFixed(2) +
          "\n" +
          otherTokens.join("\n") +
          "\n" +
          (isStop ? "STOP" : "");
        infoEl.innerHTML = info;
      });
    }
  });
};
