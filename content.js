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

  function toFullWidth(value) {
    return String(value || "")
      .replace(/[!-~]/g, (char) => String.fromCharCode(char.charCodeAt(0) + 0xfee0))
      .replace(/ /g, "　");
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

  function splitJapaneseAddressParts(value) {
    const { prefecture, rest } = splitJapaneseAddress(value);
    const normalizedRest = rest.trim();
    const spacedParts = normalizedRest.split(/\s+/).filter(Boolean);
    if (spacedParts.length > 1) {
      const mainAddress = splitCityAndStreet(spacedParts[0]);
      return {
        prefecture,
        city: mainAddress.city,
        street: mainAddress.street,
        building: spacedParts.slice(1).join(" ")
      };
    }

    const buildingMatch = normalizedRest.match(/^(.+?[0-9０-９一二三四五六七八九十]+(?:[-－ー丁目番地号の][0-9０-９一二三四五六七八九十]+)*)(.+(?:マンション|アパート|ハイツ|コーポ|メゾン|レジデンス|ビル|荘|寮|棟|号室|Ｆ|F).*)$/);
    if (buildingMatch) {
      const mainAddress = splitCityAndStreet(buildingMatch[1]);
      return {
        prefecture,
        city: mainAddress.city,
        street: mainAddress.street,
        building: buildingMatch[2]
      };
    }

    return { prefecture, ...splitCityAndStreet(normalizedRest), building: "" };
  }

  function splitCityAndStreet(value) {
    const address = String(value || "").trim();
    const match = address.match(/^(.+?(?:市.+?区|郡.+?[町村]|市|区|町|村))(.+)$/);
    if (!match) return { city: address, street: "" };
    return {
      city: match[1],
      street: match[2]
    };
  }

  function splitName(profile) {
    return {
      fullName: [profile.lastName, profile.firstName].filter(Boolean).join(" "),
      fullNameKana: [profile.lastNameKana, profile.firstNameKana].filter(Boolean).join(" ")
    };
  }

  function splitEmail(value) {
    const [account, ...domainParts] = String(value || "").trim().split("@");
    return {
      account: domainParts.length ? account : "",
      domain: domainParts.join("@")
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

  function markNamesUsed(names, used) {
    names.forEach((name) => {
      document.querySelectorAll(`[name="${CSS.escape(name)}"]`).forEach((element) => used.add(element));
    });
  }

  function fillDirectValues(values, used) {
    let count = 0;
    for (const [name, value] of values) {
      if (value && fillByName(name, value)) count += 1;
      markNamesUsed([name], used);
    }
    return count;
  }

  function fillE2rProfile(profile, used) {
    if (!location.hostname.endsWith("e2r.jp")) return 0;

    let count = 0;
    const phoneDigits = compactDigits(profile.phone);
    const postalDigits = compactDigits(profile.postalCode);
    const birthDate = String(profile.birthDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const graduationDate = String(profile.graduationDate || "").match(/^(\d{4})-(\d{2})$/);
    const address = splitJapaneseAddressParts(profile.address);
    const genderValues = { 男性: "1", 女性: "2", その他: "3", 回答しない: "3" };

    const directValues = [
      ["I1_D1", profile.lastName],
      ["I1_D2", profile.firstName],
      ["I2_D1", profile.lastNameKana],
      ["I2_D2", profile.firstNameKana],
      ["I9", profile.email],
      ["I9_chk", profile.email],
      ["I13", address.prefecture],
      ["I14", toFullWidth(address.city)],
      ["I15", toFullWidth(address.street)],
      ["I16", toFullWidth(address.building)],
      ["I22", profile.university],
      ["I23", profile.faculty],
      ["I24", profile.department]
    ];

    count += fillDirectValues(directValues, used);
    markNamesUsed(["I10", "I10_chk"], used);

    if (genderValues[profile.gender] && fillRadioByNameValue("I68", genderValues[profile.gender])) count += 1;
    markNamesUsed(["I68"], used);

    if (birthDate) {
      count += fillSplitByNames(["I4_D1", "I4_D2", "I4_D3"], [
        birthDate[1],
        String(Number(birthDate[2])),
        String(Number(birthDate[3]))
      ]);
      markNamesUsed(["I4_D1", "I4_D2", "I4_D3"], used);
    }

    if (phoneDigits) {
      const chunks = [phoneDigits.slice(0, 3), phoneDigits.slice(3, 7), phoneDigits.slice(7)];
      count += fillSplitByNames(["I5_D1", "I5_D2", "I5_D3"], chunks);
      count += fillSplitByNames(["I8_D1", "I8_D2", "I8_D3"], chunks);
      count += fillSplitByNames(["I4417_D1", "I4417_D2", "I4417_D3"], chunks);
      markNamesUsed(["I5_D1", "I5_D2", "I5_D3", "I8_D1", "I8_D2", "I8_D3", "I4417_D1", "I4417_D2", "I4417_D3"], used);
    }

    if (postalDigits) {
      count += fillSplitByNames(["I12_D1", "I12_D2"], [
        postalDigits.slice(0, 3),
        postalDigits.slice(3)
      ]);
      markNamesUsed(["I12_D1", "I12_D2"], used);
    }

    if (graduationDate) {
      count += fillSplitByNames(["I50_D1", "I50_D2"], [
        graduationDate[1],
        String(Number(graduationDate[2]))
      ]);
      markNamesUsed(["I50_D1", "I50_D2"], used);
    }

    markNamesUsed(["I17_D1", "I17_D2", "I18", "I19", "I20", "I21", "I7_D1", "I7_D2", "I7_D3"], used);

    return count;
  }

  function fillIwebsProfile(profile, used) {
    if (!location.hostname.endsWith("i-webs.jp") && location.hostname !== "www.recruit.sony.co.jp") return 0;

    let count = 0;
    const phoneDigits = compactDigits(profile.phone);
    const postalDigits = compactDigits(profile.postalCode);
    const birthDate = String(profile.birthDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const graduationDate = String(profile.graduationDate || "").match(/^(\d{4})-(\d{2})$/);
    const address = splitJapaneseAddressParts(profile.address);
    const email = splitEmail(profile.email);
    const genderValues = { 男性: "1", 男: "1", 女性: "2", 女: "2" };

    const directValues = [
      ["kname1", profile.lastName],
      ["kname2", profile.firstName],
      ["yname1", profile.lastNameKana],
      ["yname2", profile.firstNameKana],
      ["gken", address.prefecture],
      ["gadrs1", toFullWidth(`${address.city}${address.street}`)],
      ["gadrs2", toFullWidth(address.building)]
    ];

    for (const [name, value] of directValues) {
      if (value && fillByName(name, value)) count += 1;
      markNamesUsed([name], used);
    }

    if (genderValues[profile.gender] && fillRadioByNameValue("sexcd", genderValues[profile.gender])) count += 1;
    markNamesUsed(["sexcd"], used);

    if (birthDate) {
      count += fillSplitByNames(["ybirth", "mbirth", "dbirth"], [
        birthDate[1],
        birthDate[2],
        birthDate[3]
      ]);
      markNamesUsed(["ybirth", "mbirth", "dbirth"], used);
    }

    if (postalDigits) {
      count += fillSplitByNames(["gyubin1", "gyubin2"], [
        postalDigits.slice(0, 3),
        postalDigits.slice(3)
      ]);
      markNamesUsed(["gyubin1", "gyubin2"], used);
    }

    if (phoneDigits) {
      const phoneChunks = [
        phoneDigits.slice(0, 3),
        phoneDigits.slice(3, 7),
        phoneDigits.slice(7)
      ];
      count += fillSplitByNames(["gtel1", "gtel2", "gtel3"], phoneChunks);
      count += fillSplitByNames(["kttel1", "kttel2", "kttel3"], [
        phoneChunks[0],
        phoneChunks[1],
        phoneChunks[2]
      ]);
      markNamesUsed(["gtel1", "gtel2", "gtel3", "kttel1", "kttel2", "kttel3"], used);
    }

    if (fillByName("adch", "1")) count += 1;
    markNamesUsed(["adch", "kyubin1", "kyubin2", "kken", "kadrs1", "kadrs2", "ktel1", "ktel2", "ktel3"], used);

    if (graduationDate) {
      count += fillSplitByNames(["syear", "smonth"], [
        graduationDate[1],
        graduationDate[2]
      ]);
      fillByName("shikbn", "卒業（修了）見込み");
      markNamesUsed(["syear", "smonth", "shikbn"], used);
    }

    if (email.account && email.domain) {
      const emailNames = [
        ["account1", email.account],
        ["domain1", email.domain],
        ["account2", email.account],
        ["domain2", email.domain]
      ];
      for (const [name, value] of emailNames) {
        if (fillByName(name, value)) count += 1;
      }
      markNamesUsed([
        ...emailNames.map(([name]) => name),
        "account3",
        "domain3",
        "account4",
        "domain4"
      ], used);
    }

    return count;
  }

  function fillSnarProfile(profile, used) {
    if (!location.hostname.endsWith("snar.jp")) return 0;

    let count = 0;
    const phoneDigits = compactDigits(profile.phone);
    const postalDigits = compactDigits(profile.postalCode);
    const birthDate = String(profile.birthDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const graduationDate = String(profile.graduationDate || "").match(/^(\d{4})-(\d{2})$/);
    const address = splitJapaneseAddressParts(profile.address);
    const genderValues = { 男性: "rbt_sex1", 男: "rbt_sex1", 女性: "rbt_sex2", 女: "rbt_sex2", その他: "rbt_sex3", 回答しない: "rbt_sex3" };

    count += fillDirectValues([
      ["tbx_name1", profile.lastName],
      ["tbx_name2", profile.firstName],
      ["tbx_kana1", profile.lastNameKana],
      ["tbx_kana2", profile.firstNameKana],
      ["tbx_mail", profile.email],
      ["tbx_mail_R", profile.email],
      ["ddl_ken", address.prefecture],
      ["ddl_kenList", address.prefecture],
      ["tbx_addr1", toFullWidth(`${address.city}${address.street}`)],
      ["tbx_addr2", toFullWidth(address.building)],
      ["tbx_school", profile.university],
      ["tbx_gakubu", profile.faculty],
      ["tbx_gakka", profile.department]
    ], used);
    markNamesUsed(["tbx_smail", "tbx_smail_R"], used);

    if (genderValues[profile.gender] && fillRadioByNameValue("rbt_sex", genderValues[profile.gender])) count += 1;
    markNamesUsed(["rbt_sex"], used);

    if (birthDate) {
      count += fillDirectValues([
        ["ddl_birthY", birthDate[1]],
        ["ddl_birthM", String(Number(birthDate[2]))],
        ["ddl_birthD", String(Number(birthDate[3]))]
      ], used);
    }

    if (phoneDigits) {
      const phoneChunks = [
        phoneDigits.slice(0, 3),
        phoneDigits.slice(3, 7),
        phoneDigits.slice(7)
      ];
      count += fillSplitByNames(["tbx_keitai1", "tbx_keitai2", "tbx_keitai3"], phoneChunks);
      count += fillSplitByNames(["tbx_tel11", "tbx_tel12", "tbx_tel13"], phoneChunks);
      markNamesUsed(["tbx_keitai1", "tbx_keitai2", "tbx_keitai3", "tbx_tel11", "tbx_tel12", "tbx_tel13"], used);
    }

    if (postalDigits) {
      count += fillSplitByNames(["tbx_zip1", "tbx_zip2"], [
        postalDigits.slice(0, 3),
        postalDigits.slice(3)
      ]);
      markNamesUsed(["tbx_zip1", "tbx_zip2"], used);
    }

    if (graduationDate) {
      count += fillDirectValues([
        ["ddl_sotsuyY", graduationDate[1]],
        ["ddl_sotsuyM", String(Number(graduationDate[2]))],
        ["ddl_sotsuk", "卒業予定"]
      ], used);
    }

    if (fillByName("cbx_kflg", "on")) count += 1;
    markNamesUsed(["cbx_kflg", "tbx_kzip1", "tbx_kzip2", "ddl_kken", "tbx_kaddr1", "tbx_kaddr2"], used);

    return count;
  }

  function fillAxolProfile(profile, used) {
    if (!location.hostname.endsWith("axol.jp")) return 0;

    let count = 0;
    const phoneDigits = compactDigits(profile.phone);
    const postalDigits = compactDigits(profile.postalCode);
    const birthDate = String(profile.birthDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const graduationDate = String(profile.graduationDate || "").match(/^(\d{4})-(\d{2})$/);
    const address = splitJapaneseAddressParts(profile.address);
    const genderValues = { 男性: "1", 男: "1", 女性: "2", 女: "2", その他: "4", 回答しない: "4" };

    count += fillDirectValues([
      ["kanji_sei", profile.lastName],
      ["kanji_na", profile.firstName],
      ["kana_sei", profile.lastNameKana],
      ["kana_na", profile.firstNameKana],
      ["keng", address.prefecture],
      ["jushog1", toFullWidth(address.city)],
      ["jushog2", toFullWidth(address.street)],
      ["jushog3", toFullWidth(address.building)],
      ["email", profile.email],
      ["email2", profile.email],
      ["c_school_name", profile.university],
      ["c_gakubu_name", profile.faculty],
      ["c_gakka_name", profile.department]
    ], used);

    if (genderValues[profile.gender] && fillRadioByNameValue("sex", genderValues[profile.gender])) count += 1;
    markNamesUsed(["sex"], used);

    if (birthDate) {
      count += fillDirectValues([
        ["birth_Y", birthDate[1]],
        ["birth_m", birthDate[2]],
        ["birth_d", birthDate[3]]
      ], used);
    }

    if (phoneDigits) {
      const phoneChunks = [
        phoneDigits.slice(0, 3),
        phoneDigits.slice(3, 7),
        phoneDigits.slice(7)
      ];
      count += fillSplitByNames(["telg_h", "telg_m", "telg_l"], phoneChunks);
      count += fillSplitByNames(["keitai_h", "keitai_m", "keitai_l"], phoneChunks);
      markNamesUsed(["telg_kaigai", "telg_h", "telg_m", "telg_l", "keitai_kaigai", "keitai_h", "keitai_m", "keitai_l"], used);
    }

    if (postalDigits) {
      count += fillSplitByNames(["yubing_h", "yubing_l"], [
        postalDigits.slice(0, 3),
        postalDigits.slice(3)
      ]);
      markNamesUsed(["yubing_kaigai", "yubing_h", "yubing_l"], used);
    }

    if (graduationDate) {
      count += fillDirectValues([
        ["c_school_to_Y", graduationDate[1]],
        ["c_school_to_m", graduationDate[2]],
        ["c_school_to_kubun", "卒業予定"]
      ], used);
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
    filledCount += fillIwebsProfile(profile, used);
    filledCount += fillSnarProfile(profile, used);
    filledCount += fillAxolProfile(profile, used);

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
