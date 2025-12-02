import React, { useState } from "react"; 

// Agenda Maker - single-file React component

// - Tailwind CSS for styling

// - npm i file-saver jspdf docx date-fns

import { saveAs } from "file-saver";

import { jsPDF } from "jspdf";

import { Document, Packer, Paragraph, TextRun } from "docx";

import { parse, format, addMinutes, differenceInMinutes } from "date-fns";

 

export default function AgendaMaker() {

  const [events, setEvents] = useState([

    { id: 1, time: "08:00", title: "", subs: [] },

  ]);

 

  const [darkMode, setDarkMode] = useState(false);

  const [draggingId, setDraggingId] = useState(null);

 

  // Utility: parse time string "HH:mm" to Date on today

  const parseTime = (hhmm) => parse(hhmm, "HH:mm", new Date());

  const formatTime = (date) => format(date, "HH:mm");

 

  const nextDefaultTime = (list) => {

    if (list.length === 0) return "08:00";

    const last = list[list.length - 1];

    const d = parseTime(last.time);

    return formatTime(addMinutes(d, 15));

  };

 

  const defaultSubTime = (event) => {

    if (!event.subs || event.subs.length === 0) {

      return event.time || "08:00";

    }

    const last = event.subs[event.subs.length - 1];

    const baseTime = last.time || event.time || "08:00";

    const d = parseTime(baseTime);

    return formatTime(addMinutes(d, 15));

  };

 

  const addEventAtEnd = () => {

    setEvents((prev) => [

      ...prev,

      {

        id: Date.now() + Math.random(),

        time: nextDefaultTime(prev),

        title: "",

        subs: [],

      },

    ]);

  };

 

  const updateEvent = (index, partial) => {

    setEvents((prev) => {

      const copy = [...prev];

      copy[index] = { ...copy[index], ...partial };

      return copy;

    });

  };

 

  // When changing time of an event, propagate the delta to all subsequent MAIN events

  const changeEventTime = (index, newTimeStr) => {

    setEvents((prev) => {

      const copy = [...prev];

      const old = copy[index].time;

      if (old === newTimeStr) return copy;

      const oldD = parseTime(old);

      const newD = parseTime(newTimeStr);

      const delta = differenceInMinutes(newD, oldD);

 

      copy[index] = { ...copy[index], time: newTimeStr };

 

      if (delta !== 0) {

        for (let i = index + 1; i < copy.length; i++) {

          const d = addMinutes(parseTime(copy[i].time), delta);

          copy[i] = { ...copy[i], time: formatTime(d) };

        }

      }

      return copy;

    });

  };

 

  const addSubTo = (index) => {

    setEvents((prev) => {

      const copy = [...prev];

      const event = copy[index];

      const newSub = {

        id: Date.now() + Math.random(),

        time: defaultSubTime(event),

        title: "",

      };

      const subs = [...event.subs, newSub];

      copy[index] = { ...event, subs };

      return copy;

    });

  };

 

  const updateSub = (evIndex, subIndex, partial) => {

    setEvents((prev) => {

      const copy = [...prev];

      const event = copy[evIndex];

      const subs = [...event.subs];

      subs[subIndex] = { ...subs[subIndex], ...partial };

      copy[evIndex] = { ...event, subs };

      return copy;

    });

  };

 

  // Changing SUB time affects ONLY that sub-element

  const changeSubTime = (evIndex, subIndex, newTimeStr) => {

    setEvents((prev) => {

      const copy = [...prev];

      const event = copy[evIndex];

      const subs = [...event.subs];

      subs[subIndex] = { ...subs[subIndex], time: newTimeStr };

      copy[evIndex] = { ...event, subs };

      return copy;

    });

  };

 

  const removeEvent = (index) => {

    setEvents((prev) => prev.filter((_, i) => i !== index));

  };

 

  const removeSub = (evIndex, subIndex) => {

    setEvents((prev) => {

      const copy = [...prev];

      const event = copy[evIndex];

      const subs = event.subs.filter((_, i) => i !== subIndex);

      copy[evIndex] = { ...event, subs };

      return copy;

    });

  };

 

  // Drag & drop reorder for main events

  const moveEvent = (fromId, toId) => {

    setEvents((prev) => {

      if (fromId === null || toId === null || fromId === toId) return prev;

      const currentIndex = prev.findIndex((e) => e.id === fromId);

      const targetIndex = prev.findIndex((e) => e.id === toId);

      if (currentIndex === -1 || targetIndex === -1) return prev;

      const copy = [...prev];

      const [item] = copy.splice(currentIndex, 1);

      copy.splice(targetIndex, 0, item);

      return copy;

    });

  };

 

  const handleDragStart = (e, id) => {

    setDraggingId(id);

    e.dataTransfer.effectAllowed = "move";

  };

 

  const handleDragOver = (e) => {

    e.preventDefault();

    e.dataTransfer.dropEffect = "move";

  };

 

  const handleDrop = (e, targetId) => {

    e.preventDefault();

    moveEvent(draggingId, targetId);

    setDraggingId(null);

  };

 

  const handleDragEnd = () => {

    setDraggingId(null);

  };

 

  // Export helpers

  const buildPlainText = () => {

    let lines = [];

    lines.push("Agenda \n");

    events.forEach((ev) => {

      lines.push(`${ev.time} - ${ev.title}`);

      ev.subs.forEach((s) => {

        lines.push(`  • ${s.time} - ${s.title}`);

      });

    });

    return lines.join("\n");

  };

 

  const exportAsText = () => {

    const txt = buildPlainText();

    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });

    saveAs(blob, "agenda.txt");

  };

 

  const exportAsPDF = async () => {

    const doc = new jsPDF();

    doc.setFontSize(18);

    doc.text("An Agenda Maker", 20, 20);

    let y = 30;

    doc.setFontSize(12);

    events.forEach((ev) => {

      doc.text(`${ev.time} - ${ev.title}`, 20, y);

      y += 6;

      ev.subs.forEach((s) => {

        doc.text(`• ${s.time} - ${s.title}`, 30, y);

        y += 6;

      });

      y += 4;

      if (y > 270) {

        doc.addPage();

        y = 20;

      }

    });

    doc.save("agenda.pdf");

  };

 

  const exportAsWord = async () => {

    const doc = new Document();

    const children = [];

    children.push(

      new Paragraph({

        children: [new TextRun({ text: "An Agenda Maker", bold: true, size: 32 })],

      })

    );

    children.push(new Paragraph({ text: "" }));

 

    events.forEach((ev) => {

      children.push(

        new Paragraph({

          children: [

            new TextRun({

              text: `${ev.time} - ${ev.title}`,

              bold: false,

              size: 24,

            }),

          ],

        })

      );

      ev.subs.forEach((s) => {

        children.push(

          new Paragraph({

            text: `• ${s.time} - ${s.title}`,

          })

        );

      });

      children.push(new Paragraph({ text: "" }));

    });

 

    doc.addSection({ children });

    const packer = new Packer();

    const blob = await packer.toBlob(doc);

    saveAs(blob, "agenda.docx");

  };

 

  const exportAsOutlook = () => {

    const lines = [];

    const today = new Date();

    const y = today.getFullYear();

    const m = String(today.getMonth() + 1).padStart(2, "0");

    const d = String(today.getDate()).padStart(2, "0");

 

    lines.push("BEGIN:VCALENDAR");

    lines.push("VERSION:2.0");

    lines.push("PRODID:-//AgendaMaker//EN");

 

    events.forEach((ev, i) => {

      const t = ev.time.split(":");

      const hh = t[0];

      const mm = t[1];

      const start = `${y}${m}${d}T${hh}${mm}00`;

      const endD = formatTime(addMinutes(parseTime(ev.time), 15)).split(":");

      const end = `${y}${m}${d}T${endD[0]}${endD[1]}00`;

 

      lines.push("BEGIN:VEVENT");

      lines.push(`UID:${Date.now()}-${i}@agendamaker`);

      lines.push(`DTSTAMP:${y}${m}${d}T000000Z`);

      lines.push(`DTSTART:${start}`);

      lines.push(`DTEND:${end}`);

      lines.push(`SUMMARY:${ev.title}`);

      if (ev.subs.length) {

        const desc = ev.subs

          .map((s) => `${s.time} - ${s.title}`)

          .join("\n");

        lines.push(`DESCRIPTION:${desc}`);

      }

      lines.push("END:VEVENT");

    });

 

    lines.push("END:VCALENDAR");

 

    const blob = new Blob([lines.join("\r\n")], {

      type: "text/calendar;charset=utf-8",

    });

    saveAs(blob, "agenda.ics");

  };

 

  // Styling helpers depending on theme

  const pageBg = darkMode ? "bg-slate-950 text-slate-100" : "bg-[#f5e9d8] text-slate-900";

  const cardBg =

    darkMode ? "bg-slate-900/80 border-slate-700" : "bg-white/90 border-amber-200";

  const subBg =

    darkMode ? "bg-slate-950 border-slate-700" : "bg-amber-50 border-amber-200";

 

  return (

    <div

      className={`${pageBg} min-h-screen flex items-center justify-center px-3 py-6 sm:px-6`}

    >

      <div className="w-full max-w-4xl">

        {/* Header */}

        <header className="flex items-center justify-between mb-6">

          <div className="text-center flex-1">

            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">

              An Agenda Maker

            </h1>

            <p className="mt-1 text-xs sm:text-sm opacity-70">

              Plane deinen Tag mit Zeiten, Titeln und Unterelementen

            </p>

          </div>

          <button

            onClick={() => setDarkMode((d) => !d)}

            className="ml-3 shrink-0 inline-flex items-center gap-1 rounded-full border border-black/10 dark:border-slate-700 px-3 py-1.5 text-xs bg-white/60 dark:bg-slate-800/80 shadow-sm hover:shadow transition"

          >

            <span className="text-lg">{darkMode ? "🌙" : "☀️"}</span>

            <span>{darkMode ? "Dark" : "Light"}</span>

          </button>

        </header>

 

        {/* Main card */}

        <main

          className={`rounded-3xl border shadow-xl px-4 sm:px-6 md:px-8 py-6 sm:py-8 space-y-6 ${cardBg}`}

        >

          <div className="space-y-4">

            {events.map((ev, idx) => (

              <div

                key={ev.id}

                draggable

                onDragStart={(e) => handleDragStart(e, ev.id)}

                onDragOver={handleDragOver}

                onDrop={(e) => handleDrop(e, ev.id)}

                onDragEnd={handleDragEnd}

                className={`rounded-2xl border px-4 sm:px-5 py-4 sm:py-5 shadow-sm transition-transform ${

                  draggingId === ev.id ? "opacity-70 scale-[0.99]" : ""

                } ${

                  darkMode

                    ? "bg-slate-900/80 border-slate-700"

                    : "bg-white/90 border-amber-200"

                }`}

              >

                {/* Main event row: drag handle + time + title + buttons */}

                <div className="flex flex-wrap items-end gap-3 sm:gap-4">

                  <div className="flex items-center gap-2">

                    <span className="cursor-grab text-xl leading-none select-none">

                      ≡

                    </span>

                  </div>

 

                  <div className="flex flex-1 flex-wrap items-end gap-3 sm:gap-4">

                    <div className="w-full sm:w-32">

                      <label className="text-[11px] font-medium uppercase tracking-wide opacity-60">

                        Uhrzeit

                      </label>

                      <input

                        type="time"

                        value={ev.time}

                        onChange={(e) => changeEventTime(idx, e.target.value)}

                        className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 ${

                          darkMode

                            ? "bg-slate-950 border-slate-700"

                            : "bg-white border-amber-200"

                        }`}

                      />

                    </div>

 

                    <div className="flex-1 min-w-[8rem]">

                      <label className="text-[11px] font-medium uppercase tracking-wide opacity-60">

                        Titel

                      </label>

                      <input

                        type="text"

                        value={ev.title}

                        onChange={(e) => updateEvent(idx, { title: e.target.value })}

                        placeholder="Bezeichnung des Events"

                        className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 ${

                          darkMode

                            ? "bg-slate-950 border-slate-700"

                            : "bg-white border-amber-200"

                        }`}

                      />

                    </div>

                  </div>

 

                  <div className="flex items-center gap-2 ml-auto">

                    <button

                      onClick={() => addSubTo(idx)}

                      className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs sm:text-sm hover:opacity-90 transition

                                 border-blue-500/60 text-blue-600 dark:border-blue-400/60 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/30"

                    >

                      <span className="text-sm">+</span>

                      Unterelement hinzufügen

                    </button>

                    <button

                      onClick={() => removeEvent(idx)}

                      className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs sm:text-sm hover:bg-red-500/10 transition border-red-500/60 text-red-500"

                    >

                      Entfernen

                    </button>

                  </div>

                </div>

 

                {/* Sub-elements */}

                {ev.subs.length > 0 && (

                  <div className="mt-4 space-y-2">

                    {ev.subs.map((sub, si) => (

                      <div

                        key={sub.id}

                        className={`flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl border px-3 sm:px-4 py-2 ${

                          subBg

                        }`}

                      >

                        <span className="select-none text-lg leading-none">•</span>

 

                        <div className="w-24 sm:w-28">

                          <label className="text-[10px] uppercase tracking-wide opacity-60">

                            Uhrzeit

                          </label>

                          <input

                            type="time"

                            value={sub.time}

                            onChange={(e) => changeSubTime(idx, si, e.target.value)}

                            className="mt-1 w-full rounded-xl border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/70 bg-transparent"

                          />

                        </div>

 

                        <div className="flex-1 min-w-[7rem]">

                          <label className="text-[10px] uppercase tracking-wide opacity-60">

                            Unterelement

                          </label>

                          <input

                            type="text"

                            value={sub.title}

                            onChange={(e) =>

                              updateSub(idx, si, { title: e.target.value })

                            }

                            placeholder="Titel des Unterelements"

                            className="mt-1 w-full rounded-xl border px-2 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70 bg-transparent"

                          />

                        </div>

 

                        <button

                          onClick={() => removeSub(idx, si)}

                          className="ml-auto text-xs sm:text-sm text-red-500 hover:text-red-400 px-2 py-1 rounded-full hover:bg-red-500/10 transition"

                        >

                          ✕

                        </button>

                      </div>

                    ))}

                  </div>

                )}

              </div>

            ))}

          </div>

 

          {/* Single global "Element hinzufügen" button */}

          <div className="pt-2 flex justify-center">

            <button

              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full shadow-md text-sm font-medium transition"

              onClick={addEventAtEnd}

            >

              <span className="text-lg leading-none">+</span>

              Element hinzufügen

            </button>

          </div>

 

          {/* Export buttons */}

          <div className="pt-6 border-t border-black/10 dark:border-slate-700 flex flex-wrap items-center justify-center gap-3">

            <button

              onClick={exportAsText}

              className="px-4 py-2 rounded-full border text-xs sm:text-sm hover:opacity-90 transition border-black/10 dark:border-slate-600 bg-white/70 dark:bg-slate-800"

            >

              Export as Text

            </button>

            <button

              onClick={exportAsPDF}

              className="px-4 py-2 rounded-full border text-xs sm:text-sm hover:opacity-90 transition border-black/10 dark:border-slate-600 bg-white/70 dark:bg-slate-800"

            >

              Export as PDF

            </button>

            <button

              onClick={exportAsWord}

              className="px-4 py-2 rounded-full border text-xs sm:text-sm hover:opacity-90 transition border-black/10 dark:border-slate-600 bg-white/70 dark:bg-slate-800"

            >

              Export as Word

            </button>

            <button

              onClick={exportAsOutlook}

              className="px-4 py-2 rounded-full border text-xs sm:text-sm hover:opacity-90 transition border-black/10 dark:border-slate-600 bg-white/70 dark:bg-slate-800"

            >

              Export as Outlook element

            </button>

          </div>

          {/* Footer */}

          <footer className="mt-4 pt-4 border-t border-black/10 dark:border-slate-700 text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-500 dark:text-slate-400">

            <span>

              © {new Date().getFullYear()} · Made with{" "}

              <span className="text-red-500">♥</span> by Tsvetina

            </span>

            <a

              href="https://www.linkedin.com/in/YOUR-LINK-HERE" target="_blank"

              rel="noreferrer"

              className="underline underline-offset-4 hover:text-blue-600 dark:hover:text-blue-400"

            >

              Connect on LinkedIn

            </a>

          </footer>

        </main>

      </div>

    </div>

  );

}