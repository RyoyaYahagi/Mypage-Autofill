(function () {
  if (window.myPageAutofill) return;

  const FIELD_DEFINITIONS = [
    { key: "lastName", labels: ["姓", "名字", "氏名 姓", "氏名（姓）", "氏名(姓)"], type: "text" },
    { key: "firstName", labels: ["名", "名前", "氏名 名", "氏名（名）", "氏名(名)"], type: "text" },
    { key: "lastNameKana", labels: ["姓カナ", "セイ", "ふりがな 姓", "フリガナ 姓", "氏名カナ 姓", "氏名カナ（姓）", "氏名カナ(姓)"], type: "text" },
    { key: "firstNameKana", labels: ["名カナ", "メイ", "ふりがな 名", "フリガナ 名", "氏名カナ 名", "氏名カナ（名）", "氏名カナ(名)"], type: "text" },
    { key: "gender", labels: ["性別"], type: "choice" },
    { key: "birthDate", labels: ["生年月日", "誕生日", "生まれ"], type: "date" },
    { key: "email", labels: ["メール", "mail", "e-mail"], type: "text" },
    { key: "emailConfirmation", labels: ["メール確認", "確認用メール", "メールアドレス確認", "メールアドレス（確認）", "メールアドレス(確認)"], type: "text" },
    { key: "phone", labels: ["電話", "携帯", "tel"], type: "tel" },
    { key: "postalCode", labels: ["郵便", "zip", "郵便番号"], type: "postal" },
    { key: "address", labels: ["住所", "現住所", "都道府県", "市区町村"], type: "text" },
    { key: "university", labels: ["大学", "学校名", "学校"], type: "text" },
    { key: "faculty", labels: ["学部"], type: "text" },
    { key: "department", labels: ["学科", "専攻"], type: "text" },
    { key: "graduationDate", labels: ["卒業", "卒業予定"], type: "month" }
  ];

  function normalizeText(value) {
    return String(value || "")
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function compactDigits(value) {
    return String(value || "").replace(/[^\d]/g, "");
  }

  function splitJapaneseAddress(value) {
    const address = String(value || "").trim();
    const prefectures = [
      "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
      "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
      "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
      "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
      "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
      "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
      "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県"
    ];
    const prefecture = prefectures.find((item) => address.startsWith(item)) || "";
    return {
      prefecture,
      rest: prefecture ? address.slice(prefecture.length).trim() : address
    };
  }

  function splitName(profile) {
    return {
      fullName: [profile.lastName, profile.firstName].filter(Boolean).join(" "),
      fullNameKana: [profile.lastNameKana, profile.firstNameKana].filter(Boolean).join(" ")
    };
  }

  function getElementContext(element) {
    const parts = [
      element.name,
      element.id,
      element.getAttribute("aria-label"),
      element.getAttribute("placeholder"),
      element.getAttribute("autocomplete")
    ];

    if (element.id) {
      const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
      if (label) parts.push(label.innerText);
    }

    const wrappingLabel = element.closest("label");
    if (wrappingLabel) parts.push(wrappingLabel.innerText);

    const row = element.closest("tr, .form-group, .form_item, .form-item, dl, li, p, div");
    if (row) parts.push(row.innerText);

    return normalizeText(parts.filter(Boolean).join(" "));
  }

  function getFieldGroup(element, candidates) {
    const container = element.closest("tr, .form-group, .form_item, .form-item, dl, li, p, div");
    if (!container) return [element];
    return candidates.filter((candidate) => container.contains(candidate));
  }

  function scoreField(element, definition) {
    const context = getElementContext(element);
    if (!context) return 0;

    let score = 0;
    for (const label of definition.labels) {
      if (context.includes(normalizeText(label))) score += 5;
    }

    if (definition.key === "email" && element.type === "email") score += 6;
    if (definition.key === "phone" && element.type === "tel") score += 4;
    if (definition.key === "postalCode" && element.autocomplete === "postal-code") score += 4;
    if (definition.key === "address" && element.autocomplete === "street-address") score += 4;

    const negativeHints = {
      lastName: ["かな", "カナ", "mail", "電話"],
      firstName: ["かな", "カナ", "mail", "電話"],
      lastNameKana: ["漢字", "mail", "電話"],
      firstNameKana: ["漢字", "mail", "電話"],
      email: ["確認"],
      emailConfirmation: ["パスワード"],
      phone: ["郵便"],
      postalCode: ["電話"]
    };

    for (const hint of negativeHints[definition.key] || []) {
      if (context.includes(normalizeText(hint))) score -= 3;
    }

    return score;
  }

  function getProfileValue(profile, key) {
    const derived = splitName(profile);
    if (key === "birthDate") return profile.birthDate || "";
    if (key === "graduationDate") return profile.graduationDate || "";
    if (key === "emailConfirmation") return profile.email || "";
    if (key === "lastName" && !profile.lastName) return derived.fullName;
    if (key === "lastNameKana" && !profile.lastNameKana) return derived.fullNameKana;
    return profile[key] || "";
  }

  function setNativeValue(element, value) {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

    if (descriptor?.set) {
      descriptor.set.call(element, value);
    } else {
      element.value = value;
    }

    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setSelectValue(select, value) {
    const normalizedValue = normalizeText(value);
    const option = Array.from(select.options).find((item) => {
      return normalizeText(item.value) === normalizedValue ||
        normalizeText(item.textContent).includes(normalizedValue) ||
        normalizedValue.includes(normalizeText(item.textContent));
    });

    if (!option) return false;
    select.value = option.value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function setChoiceValue(elements, value) {
    const normalizedValue = normalizeText(value);
    for (const element of elements) {
      const context = getElementContext(element);
      const optionValue = normalizeText(element.value);
      if (context.includes(normalizedValue) || optionValue === normalizedValue) {
        element.checked = true;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  function fillDateParts(elements, value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return 0;

    const [, year, month, day] = match;
    const parts = [
      { labels: ["年", "year"], value: year },
      { labels: ["月", "month"], value: String(Number(month)) },
      { labels: ["日", "day"], value: String(Number(day)) }
    ];
    let count = 0;

    for (const part of parts) {
      const target = elements.find((element) => {
        const context = getElementContext(element);
        return part.labels.some((label) => context.includes(normalizeText(label)));
      });
      if (target && fillControl(target, part.value)) count += 1;
    }

    return count;
  }

  function fillMonthParts(elements, value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})$/);
    if (!match) return 0;

    const [, year, month] = match;
    const parts = [
      { labels: ["年", "year"], value: year },
      { labels: ["月", "month"], value: String(Number(month)) }
    ];
    let count = 0;

    for (const part of parts) {
      const target = elements.find((element) => {
        const context = getElementContext(element);
        return part.labels.some((label) => context.includes(normalizeText(label)));
      });
      if (target && fillControl(target, part.value)) count += 1;
    }

    return count;
  }

  function fillSplitDigits(elements, value) {
    const digits = compactDigits(value);
    if (!digits) return 0;

    const visible = elements.filter((element) => element.offsetParent !== null && !element.disabled && !element.readOnly);
    if (visible.length <= 1) return 0;

    const chunks = visible.length === 2
      ? [digits.slice(0, 3), digits.slice(3)]
      : [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7)];

    let count = 0;
    visible.slice(0, chunks.length).forEach((element, index) => {
      if (chunks[index]) {
        setNativeValue(element, chunks[index]);
        count += 1;
      }
    });
    return count;
  }

  function getControlByName(name) {
    return document.querySelector(`[name="${CSS.escape(name)}"]`);
  }

  function fillByName(name, value) {
    const element = getControlByName(name);
    return element ? fillControl(element, value) : false;
  }

  function fillRadioByNameValue(name, value) {
    const element = Array.from(document.querySelectorAll(`[name="${CSS.escape(name)}"]`))
      .find((item) => item instanceof HTMLInputElement && item.type === "radio" && item.value === value);
    if (!element) return false;
    element.checked = true;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function fillSplitByNames(names, chunks) {
    let count = 0;
    names.forEach((name, index) => {
      if (chunks[index] && fillByName(name, chunks[index])) count += 1;
    });
    return count;
  }

  function fillE2rProfile(profile, used) {
    if (!location.hostname.endsWith("e2r.jp")) return 0;

    let count = 0;
    const phoneDigits = compactDigits(profile.phone);
    const postalDigits = compactDigits(profile.postalCode);
    const birthDate = String(profile.birthDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const graduationDate = String(profile.graduationDate || "").match(/^(\d{4})-(\d{2})$/);
    const address = splitJapaneseAddress(profile.address);
    const genderValues = { 男性: "1", 女性: "2", その他: "3", 回答しない: "3" };

    const directValues = [
      ["I1_D1", profile.lastName],
      ["I1_D2", profile.firstName],
      ["I2_D1", profile.lastNameKana],
      ["I2_D2", profile.firstNameKana],
      ["I9", profile.email],
      ["I9_chk", profile.email],
      ["I13", address.prefecture],
      ["I14", address.rest],
      ["I22", profile.university],
      ["I23", profile.faculty],
      ["I24", profile.department]
    ];

    for (const [name, value] of directValues) {
      if (value && fillByName(name, value)) {
        const element = getControlByName(name);
        if (element) used.add(element);
        count += 1;
      }
    }

    if (genderValues[profile.gender] && fillRadioByNameValue("I68", genderValues[profile.gender])) count += 1;

    if (birthDate) {
      count += fillSplitByNames(["I4_D1", "I4_D2", "I4_D3"], [
        birthDate[1],
        String(Number(birthDate[2])),
        String(Number(birthDate[3]))
      ]);
    }

    if (phoneDigits) {
      const chunks = [phoneDigits.slice(0, 3), phoneDigits.slice(3, 7), phoneDigits.slice(7)];
      count += fillSplitByNames(["I5_D1", "I5_D2", "I5_D3"], chunks);
      count += fillSplitByNames(["I4417_D1", "I4417_D2", "I4417_D3"], chunks);
    }

    if (postalDigits) {
      count += fillSplitByNames(["I12_D1", "I12_D2"], [
        postalDigits.slice(0, 3),
        postalDigits.slice(3)
      ]);
    }

    if (graduationDate) {
      count += fillSplitByNames(["I50_D1", "I50_D2"], [
        graduationDate[1],
        String(Number(graduationDate[2]))
      ]);
    }

    return count;
  }

  function fillControl(element, value) {
    if (!value || element.disabled || element.readOnly) return false;

    if (element instanceof HTMLSelectElement) {
      return setSelectValue(element, value);
    }

    if (element instanceof HTMLInputElement && ["radio", "checkbox"].includes(element.type)) {
      return setChoiceValue([element], value);
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      setNativeValue(element, value);
      return true;
    }

    return false;
  }

  function chooseBestElement(elements, definition) {
    return elements
      .map((element) => ({ element, score: scoreField(element, definition) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.element || null;
  }

  function fill(profile) {
    const controls = Array.from(document.querySelectorAll("input, select, textarea"))
      .filter((element) => {
        if (["hidden", "password", "submit", "button"].includes(element.type)) return false;
        if (element.closest("[aria-hidden='true']")) return false;
        return true;
      });

    const used = new Set();
    let filledCount = fillE2rProfile(profile, used);

    for (const definition of FIELD_DEFINITIONS) {
      const value = getProfileValue(profile, definition.key);
      if (!value) continue;

      const candidates = controls.filter((element) => !used.has(element));
      const best = chooseBestElement(candidates, definition);
      if (!best) continue;

      if (definition.type === "choice") {
        const name = best.name;
        const group = name
          ? candidates.filter((element) => element.name === name && ["radio", "checkbox"].includes(element.type))
          : [best];
        if (best instanceof HTMLSelectElement ? setSelectValue(best, value) : setChoiceValue(group, value)) {
          group.forEach((element) => used.add(element));
          filledCount += 1;
        }
        continue;
      }

      if (definition.type === "date" && !(best instanceof HTMLInputElement && best.type === "date")) {
        const related = getFieldGroup(best, candidates);
        const count = fillDateParts(related.length > 1 ? related : candidates, value);
        if (count > 0) {
          related.forEach((element) => used.add(element));
          filledCount += count;
          continue;
        }
      }

      if (definition.type === "month" && !(best instanceof HTMLInputElement && best.type === "month")) {
        const related = getFieldGroup(best, candidates);
        const count = fillMonthParts(related.length > 1 ? related : candidates, value);
        if (count > 0) {
          related.forEach((element) => used.add(element));
          filledCount += count;
          continue;
        }
      }

      if (["tel", "postal"].includes(definition.type)) {
        const fieldGroup = getFieldGroup(best, candidates);
        const related = fieldGroup.length > 1
          ? fieldGroup
          : candidates.filter((element) => scoreField(element, definition) > 0);
        const count = fillSplitDigits(related, value);
        if (count > 1) {
          related.forEach((element) => used.add(element));
          filledCount += count;
          continue;
        }
      }

      if (fillControl(best, value)) {
        used.add(best);
        filledCount += 1;
      }
    }

    return {
      ok: true,
      filledCount,
      message: `${filledCount} fields filled`
    };
  }

  window.myPageAutofill = { fill };
})();
