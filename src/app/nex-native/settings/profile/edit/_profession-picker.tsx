"use client";

// src/app/nex-native/settings/profile/edit/_profession-picker.tsx
//
// Cascading profession picker · category → subcategory → optional
// free-text "Other…" at either level. Owner directive 2026-11-04.
// --------------------------------------------------------
// Stores the final subcategory label (or custom "Other…" text) to
// nex_account_profile.profession via the hidden input + the parent
// server form. The category is NOT stored separately · it's derived
// at load time by scanning the directory for a matching profession.
//
// UX contract:
//   · Category empty            → subcategory + text input hidden
//   · Category = real one       → subcategory dropdown with that
//                                 category's professions + "Other…"
//   · Category = Other…         → text input appears (free entry)
//   · Subcategory = real one    → submit value is that label
//   · Subcategory = Other…      → text input appears (prefilled
//                                 with current custom value)

import { useState } from "react";
import {
  PROFESSION_DIRECTORY,
  findCategoryForProfession,
  type ProfessionCategory,
} from "./_profession-directory";

const GOLD = "#C6A15B";
const OTHER = "__other__";

interface Props {
  readonly defaultValue: string;
}

interface InitState {
  readonly categoryId: string;
  readonly profession: string;
  readonly otherText: string;
}

function initialState(raw: string): InitState {
  const trimmed = raw.trim();
  if (!trimmed) return { categoryId: "", profession: "", otherText: "" };
  const cat = findCategoryForProfession(trimmed);
  if (cat) {
    const canonical = cat.professions.find(
      (p) => p.toLowerCase() === trimmed.toLowerCase(),
    );
    return {
      categoryId: cat.id,
      profession: canonical ?? OTHER,
      otherText: canonical ? "" : trimmed,
    };
  }
  // No category match · route to top-level Other with free text
  return { categoryId: OTHER, profession: "", otherText: trimmed };
}

export function ProfessionPicker({ defaultValue }: Props): React.ReactElement {
  const init = initialState(defaultValue);
  const [categoryId, setCategoryId] = useState(init.categoryId);
  const [profession, setProfession] = useState(init.profession);
  const [otherText, setOtherText] = useState(init.otherText);

  const activeCategory: ProfessionCategory | null =
    categoryId && categoryId !== OTHER
      ? PROFESSION_DIRECTORY.find((c) => c.id === categoryId) ?? null
      : null;

  // Final value for the hidden form input:
  //   · Category = Other       → otherText (user's free entry)
  //   · Subcategory = Other    → otherText
  //   · Subcategory = real one → the subcategory label itself
  //   · Nothing picked         → "" (saved as null server-side)
  let submitValue = "";
  if (categoryId === OTHER) submitValue = otherText.trim();
  else if (profession === OTHER) submitValue = otherText.trim();
  else if (profession) submitValue = profession;

  function handleCategoryChange(next: string) {
    setCategoryId(next);
    // Clear downstream fields when the top-level selection changes
    setProfession("");
    if (next !== OTHER) setOtherText("");
  }

  function handleSubcategoryChange(next: string) {
    setProfession(next);
    if (next !== OTHER) setOtherText("");
  }

  const showOtherText =
    categoryId === OTHER || (activeCategory && profession === OTHER);

  const otherPlaceholder =
    categoryId === OTHER
      ? "Type your profession"
      : "Type your profession (within this category)";

  return (
    <>
      {/* Category dropdown */}
      <select
        aria-label="Profession category"
        value={categoryId}
        onChange={(e) => handleCategoryChange(e.target.value)}
      >
        <option value="" style={{ color: "#000" }}>
          Select a category
        </option>
        {PROFESSION_DIRECTORY.map((cat) => (
          <option key={cat.id} value={cat.id} style={{ color: "#000" }}>
            {cat.label}
          </option>
        ))}
        <option value={OTHER} style={{ color: "#000" }}>
          Other…
        </option>
      </select>

      {/* Subcategory dropdown · only when a real category is picked */}
      {activeCategory ? (
        <select
          aria-label={`Profession in ${activeCategory.label}`}
          value={profession}
          onChange={(e) => handleSubcategoryChange(e.target.value)}
          style={{ marginTop: 6 }}
        >
          <option value="" style={{ color: "#000" }}>
            Select a profession
          </option>
          {activeCategory.professions.map((p) => (
            <option key={p} value={p} style={{ color: "#000" }}>
              {p}
            </option>
          ))}
          <option value={OTHER} style={{ color: "#000" }}>
            Other…
          </option>
        </select>
      ) : null}

      {/* Free-text input · appears for Other at either level */}
      {showOtherText ? (
        <input
          type="text"
          aria-label="Enter your profession"
          value={otherText}
          onChange={(e) => setOtherText(e.target.value.slice(0, 80))}
          maxLength={80}
          placeholder={otherPlaceholder}
          style={{ marginTop: 6 }}
          autoFocus
        />
      ) : null}

      <input type="hidden" name="profession" value={submitValue} />

      {showOtherText ? (
        <span style={{ fontSize: 11, color: `${GOLD}B3`, marginTop: -2 }}>
          Keep it short · ideally one word.
        </span>
      ) : null}
    </>
  );
}
