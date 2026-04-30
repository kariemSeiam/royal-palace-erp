"use client";

import { useState } from "react";

type Tab = {
  id: string;
  label: string;
  content?: string | null;
};

export function ProductTabs({ tabs }: { tabs: Tab[] }) {
  const visibleTabs = tabs.filter((t) => t.content);
  const [active, setActive] = useState(visibleTabs[0]?.id);

  if (visibleTabs.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-[28px] bg-white shadow-soft">
      <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3 md:p-4">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={`rounded-full px-4 py-2.5 text-sm font-bold transition ${
              active === tab.id
                ? "bg-royal-navy text-white"
                : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6 md:p-7">
        {visibleTabs.map((tab) =>
          tab.id === active ? (
            <div key={tab.id}>
              <h3 className="mb-4 text-lg font-bold text-royal-navy">{tab.label}</h3>
              <p className="whitespace-pre-line text-sm leading-8 text-slate-600 md:text-base">
                {tab.content}
              </p>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
