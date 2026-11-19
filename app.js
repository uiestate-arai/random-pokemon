// ランダムポケモン表示（PokeAPI v2 使用）
(() => {
  "use strict";

  const API = "https://pokeapi.co/api/v2";
  const MAX_ID = 1025; // 全国図鑑の番号範囲（第9世代まで）

  // タイプの日本語名と色
  const TYPES = {
    normal: ["ノーマル", "#9fa19f"], fire: ["ほのお", "#e62829"], water: ["みず", "#2980ef"],
    electric: ["でんき", "#fac000"], grass: ["くさ", "#3fa129"], ice: ["こおり", "#3dcef3"],
    fighting: ["かくとう", "#ff8000"], poison: ["どく", "#9141cb"], ground: ["じめん", "#915121"],
    flying: ["ひこう", "#81b9ef"], psychic: ["エスパー", "#ef4179"], bug: ["むし", "#91a119"],
    rock: ["いわ", "#afa981"], ghost: ["ゴースト", "#704170"], dragon: ["ドラゴン", "#5060e1"],
    dark: ["あく", "#624d4e"], steel: ["はがね", "#60a1b8"], fairy: ["フェアリー", "#ef70ef"],
  };

  const STATS = {
    hp: "HP", attack: "こうげき", defense: "ぼうぎょ",
    "special-attack": "とくこう", "special-defense": "とくぼう", speed: "すばやさ",
  };

  const $ = (id) => document.getElementById(id);
  const el = {
    card: $("card"), art: $("art"), placeholder: $("placeholder"), info: $("info"),
    dex: $("dex"), name: $("name"), nameEn: $("nameEn"), genus: $("genus"),
    types: $("types"), height: $("height"), weight: $("weight"), stats: $("stats"),
    flavor: $("flavor"), intro: $("intro"), error: $("error"), btn: $("drawBtn"),
  };

  let lastId = 0;
  let busy = false;

  // 直前と同じ番号は避ける
  function randomId() {
    let id;
    do { id = Math.floor(Math.random() * MAX_ID) + 1; } while (id === lastId);
    return id;
  }

  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // 指定言語のエントリを探す（日本語→日本語(漢字)→英語の順で代替）
  function pickLang(list, key) {
    for (const lang of ["ja-Hrkt", "ja", "en"]) {
      const hit = list.find((e) => e.language.name === lang);
      if (hit) return hit[key];
    }
    return "";
  }

  // 画像を読み込み終えてから表示する（ちらつき防止）
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(src);
      img.onerror = reject;
      img.src = src;
    });
  }

  function setLoading(on) {
    busy = on;
    el.btn.disabled = on;
    el.card.classList.toggle("loading", on);
    el.card.setAttribute("aria-busy", String(on));
  }

  async function draw() {
    if (busy) return;
    setLoading(true);
    el.error.hidden = true;
    el.intro.hidden = true;
    el.info.hidden = true;
    el.art.hidden = true;
    el.placeholder.hidden = false;

    const id = randomId();
    try {
      const [poke, species] = await Promise.all([
        getJSON(`${API}/pokemon/${id}`),
        getJSON(`${API}/pokemon-species/${id}`),
      ]);

      const src =
        poke.sprites?.other?.["official-artwork"]?.front_default ||
        poke.sprites?.front_default;
      if (src) await loadImage(src).catch(() => {});

      render(poke, species, src);
      lastId = id;
    } catch (err) {
      console.error(err);
      el.error.textContent = "読み込みに失敗しました。通信状況を確認して、もう一度押してください。";
      el.error.hidden = false;
    } finally {
      setLoading(false);
    }
  }

  function render(poke, species, src) {
    const jaName = pickLang(species.names, "name") || poke.name;
    const genus = pickLang(species.genera, "genus");
    const flavorEntry =
      species.flavor_text_entries.filter((e) => e.language.name.startsWith("ja")).pop() ||
      species.flavor_text_entries.filter((e) => e.language.name === "en").pop();
    const flavor = flavorEntry ? flavorEntry.flavor_text.replace(/[\n\f　]+/g, " ") : "";

    // 先頭タイプの色をテーマ色に
    const mainType = poke.types[0]?.type.name;
    document.documentElement.style.setProperty("--type", TYPES[mainType]?.[1] || "#888");

    el.dex.textContent = `No.${String(poke.id).padStart(4, "0")}`;
    el.name.textContent = jaName;
    el.nameEn.textContent = poke.name.replace(/-/g, " ");
    el.genus.textContent = genus;
    el.height.textContent = `${(poke.height / 10).toFixed(1)} m`;
    el.weight.textContent = `${(poke.weight / 10).toFixed(1)} kg`;
    el.flavor.textContent = flavor;

    el.types.replaceChildren(
      ...poke.types.map(({ type }) => {
        const li = document.createElement("li");
        const [label, color] = TYPES[type.name] || [type.name, "#888"];
        li.textContent = label;
        li.style.background = color;
        return li;
      })
    );

    el.stats.replaceChildren(
      ...poke.stats.map((s) => {
        const li = document.createElement("li");
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = STATS[s.stat.name] || s.stat.name;
        const val = document.createElement("span");
        val.className = "val";
        val.textContent = s.base_stat;
        const bar = document.createElement("span");
        bar.className = "bar";
        const fill = document.createElement("i");
        bar.append(fill);
        li.append(label, val, bar);
        // 描画後に幅を変えてアニメーションさせる（最大255）
        requestAnimationFrame(() => requestAnimationFrame(() => {
          fill.style.width = `${Math.min(100, (s.base_stat / 255) * 100)}%`;
        }));
        return li;
      })
    );

    if (src) {
      el.art.src = src;
      el.art.alt = jaName;
      el.art.hidden = false;
      el.placeholder.hidden = true;
      el.art.classList.remove("pop");
      void el.art.offsetWidth; // アニメーションを再始動
      el.art.classList.add("pop");
    }
    el.info.hidden = false;
  }

  el.btn.addEventListener("click", draw);
  // スペースキーでも引ける（入力欄はないのでボタン以外のフォーカス時のみ処理）
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && document.activeElement !== el.btn) {
      e.preventDefault();
      draw();
    }
  });
})();
