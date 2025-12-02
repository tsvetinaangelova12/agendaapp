import React, { useState, useEffect } from "react";
import { saveAs } from "file-saver";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType
} from "docx";
import { jsPDF } from "jspdf";
import { parse, format, addMinutes, differenceInMinutes } from "date-fns";

const STORAGE_KEY = "agendaMakerEvents_v1";

export default function AgendaMaker() {
  const [events, setEvents] = useState([
    { id: 1, time: "08:00", title: "", subs: [] }
  ]);
  const [darkMode, setDarkMode] = useState(false);
  const [draggingId, setDraggingId] = useState(null);
  const [draggingSub, setDraggingSub] = useState(null); // { eventId, subId } or null

  const parseTime = (hhmm) => parse(hhmm, "HH:mm", new Date());
  const formatTime = (date) => format(date, "HH:mm");

  const shiftEventWithSubs = (event, deltaMinutes) => {
    if (!deltaMinutes) return event;
    const shiftTime = (timeStr, fallback) => {
      const base = timeStr || fallback;
      const date = parseTime(base);
      return formatTime(addMinutes(date, deltaMinutes));
    };
    const newTime = shiftTime(event.time, "08:00");
    const newSubs = (event.subs || []).map((sub) => ({
      ...sub,
      time: shiftTime(sub.time, event.time || "08:00")
    }));
    return { ...event, time: newTime, subs: newSubs };
  };

  const nextDefaultTime = (list) => {
  if (list.length === 0) return "08:00";

  const lastEvent = list[list.length - 1];

  // Start with the main event time
  let baseTimeStr = lastEvent.time || "08:00";

  // If there are subelements, use the time of the LAST subelement instead
  if (lastEvent.subs && lastEvent.subs.length > 0) {
    const lastSub = lastEvent.subs[lastEvent.subs.length - 1];
    if (lastSub.time) {
      baseTimeStr = lastSub.time;
    }
  }

  const d = parseTime(baseTimeStr);
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setEvents(parsed);
      }
    } catch (e) {
      console.error("Failed to load saved agenda", e);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch (e) {
      console.error("Failed to save agenda", e);
    }
  }, [events]);

  const addEventAtEnd = () => {
    setEvents((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        time: nextDefaultTime(prev),
        title: "",
        subs: []
      }
    ]);
  };

  const updateEvent = (index, partial) => {
    setEvents((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...partial };
      return copy;
    });
  };

  const changeEventTime = (index, newTimeStr) => {
    setEvents((prev) => {
      if (!prev[index]) return prev;
      const oldTime = prev[index].time;
      if (oldTime === newTimeStr) return prev;
      const delta = differenceInMinutes(parseTime(newTimeStr), parseTime(oldTime));
      const updated = prev.map((ev, i) =>
        i < index ? ev : shiftEventWithSubs(ev, delta)
      );
      return updated;
    });
  };

  const addSubTo = (index) => {
  setEvents((prev) => {
    const copy = [...prev];
    const event = copy[index];

    // 1) Calculate the new subelement time as before
    const newSubTimeStr = defaultSubTime(event);
    const newSub = {
      id: Date.now() + Math.random(),
      time: newSubTimeStr,
      title: ""
    };

    // 2) Add the new subelement to this event
    const updatedSubs = [...event.subs, newSub];
    copy[index] = { ...event, subs: updatedSubs };

    // 3) If there is a next main event, check for overlap
    const nextIndex = index + 1;
    if (nextIndex < copy.length) {
      const newSubTime = parseTime(newSubTimeStr);
      const nextMainTime = parseTime(copy[nextIndex].time);

      // If the new sub reaches or passes the next main event time,
      // shift the next main and all following events (with subs) by +15 min
      if (newSubTime >= nextMainTime) {
        for (let i = nextIndex; i < copy.length; i++) {
          copy[i] = shiftEventWithSubs(copy[i], 15);
        }
      }
    }

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

  const changeSubTime = (evIndex, subIndex, newTimeStr) => {
  setEvents((prev) => {
    const copy = [...prev];
    const event = copy[evIndex];
    const subs = [...event.subs];

    // Old and new times of the edited subelement
    const oldTimeStr = subs[subIndex].time;
    if (oldTimeStr === newTimeStr) return prev;

    const oldTime = parseTime(oldTimeStr);
    const newTime = parseTime(newTimeStr);

    // Delta in minutes (can be positive or negative)
    const delta = differenceInMinutes(newTime, oldTime);

    // 1) Update the changed subelement
    subs[subIndex] = { ...subs[subIndex], time: newTimeStr };

    // 2) Shift all following subelements of the SAME main event
    for (let i = subIndex + 1; i < subs.length; i++) {
      const t = parseTime(subs[i].time || newTimeStr);
      subs[i] = {
        ...subs[i],
        time: formatTime(addMinutes(t, delta)),
      };
    }

    copy[evIndex] = { ...event, subs };

    // 3) Shift ALL later main events (and their subs) by the same delta
    for (let i = evIndex + 1; i < copy.length; i++) {
      copy[i] = shiftEventWithSubs(copy[i], delta);
    }

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

  const moveEvent = (fromId, toId) => {
  setEvents((prev) => {
    if (fromId == null || toId == null || fromId === toId) return prev;

    const fromIndex = prev.findIndex((e) => e.id === fromId);
    const toIndex = prev.findIndex((e) => e.id === toId);
    if (fromIndex === -1 || toIndex === -1) return prev;

    // 1) Remember the original main event times
    const originalTimes = prev.map((ev) => ev.time || "08:00");

    // 2) Sort those times chronologically
    const sortedTimes = [...originalTimes].sort(
      (a, b) => parseTime(a) - parseTime(b)
    );

    // 3) Reorder the events themselves
    const copy = [...prev];
    const [moved] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, moved);

    // 4) Assign the sorted times to the events in their NEW order,
    //    shifting each event (and its subs) by the appropriate delta
    const result = copy.map((ev, i) => {
      const newTimeStr = sortedTimes[i];
      const currentTimeStr = ev.time || newTimeStr;
      const delta = differenceInMinutes(
        parseTime(newTimeStr),
        parseTime(currentTimeStr)
      );
      return shiftEventWithSubs(ev, delta);
    });

    return result;
  });
};

  const moveSub = (eventId, fromSubId, toSubId) => {
  setEvents((prev) => {
    if (!eventId || !fromSubId || !toSubId || fromSubId === toSubId) return prev;

    const evIndex = prev.findIndex((ev) => ev.id === eventId);
    if (evIndex === -1) return prev;

    const copy = [...prev];
    const event = copy[evIndex];
    const subs = [...event.subs];
    if (subs.length < 2) return prev;

    const fromIndex = subs.findIndex((s) => s.id === fromSubId);
    const toIndex = subs.findIndex((s) => s.id === toSubId);
    if (fromIndex === -1 || toIndex === -1) return prev;

    // Remember original times of subs
    const originalTimes = subs.map(
      (s) => s.time || event.time || "08:00"
    );

    // Sort times chronologically
    const sortedTimes = [...originalTimes].sort(
      (a, b) => parseTime(a) - parseTime(b)
    );

    // Reorder the subs
    const [movedSub] = subs.splice(fromIndex, 1);
    subs.splice(toIndex, 0, movedSub);

    // Assign sorted times to subs in their NEW order
    const newSubs = subs.map((sub, i) => ({
      ...sub,
      time: sortedTimes[i],
    }));

    copy[evIndex] = { ...event, subs: newSubs };
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

  const handleSubDragStart = (e, eventId, subId) => {
  setDraggingSub({ eventId, subId });
  e.dataTransfer.effectAllowed = "move";
};

const handleSubDragOver = (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
};

const handleSubDrop = (e, eventId, targetSubId) => {
  e.preventDefault();
  if (!draggingSub) return;
  if (draggingSub.eventId !== eventId) {
    setDraggingSub(null);
    return; // only reorder within the same main event
  }
  moveSub(eventId, draggingSub.subId, targetSubId);
  setDraggingSub(null);
};

const handleSubDragEnd = () => {
  setDraggingSub(null);
};


  const buildPlainText = () => {
    const lines = [];
    lines.push("An Agenda Maker\n");
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

  const exportAsPDF = () => {
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
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              alignment: "center",
              children: [
                new TextRun({
                  text: "AGENDA",
                  bold: true,
                  size: 36,
                }),
              ],
              spacing: { after: 300 },
            }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                // HEADER — NO PADDING
                new TableRow({
                  height: { value: 500 },
                  children: [
                    new TableCell({
                      verticalAlign: "center",
                      children: [
                        new Paragraph({
                          alignment: "center",
                          children: [
                            new TextRun({
                              text: "Zeit",
                              bold: true,
                              size: 24,
                            }),
                          ],
                        }),
                      ],
                    }),
                    new TableCell({
                      verticalAlign: "center",
                      children: [
                        new Paragraph({
                          alignment: "center",
                          children: [
                            new TextRun({
                              text: "Event",
                              bold: true,
                              size: 24,
                            }),
                          ],
                        }),
                      ],
                    }),
                  ],
                }),

                // BODY ROWS
                ...events.flatMap((ev) => {
                  const rows = [];

                  // MAIN EVENT ROW — WITH LEFT PADDING
                  rows.push(
                    new TableRow({
                      height: { value: 500 },
                      children: [
                        new TableCell({
                          verticalAlign: "center",
                          margins: { left: 200 }, // LEFT padding
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: ev.time ? `${ev.time} Uhr` : "",
                                  size: 22,
                                }),
                              ],
                            }),
                          ],
                        }),

                        new TableCell({
                          verticalAlign: "center",
                          margins: { left: 200 }, // LEFT padding
                          children: [
                            new Paragraph({
                              children: [
                                new TextRun({
                                  text: ev.title || "",
                                  size: 22,
                                  bold: true,
                                }),
                              ],
                            }),
                          ],
                        }),
                      ],
                    })
                  );

                  // SUBEVENTS ROW — WITH EXTRA VERTICAL & LEFT PADDING
                  if (ev.subs && ev.subs.length > 0) {
                    rows.push(
                      new TableRow({
                        height: { value: 300 },
                        children: [
                          new TableCell({
                            verticalAlign: "center",
                            margins: { left: 200 }, // subtle padding in empty time cell
                            children: [new Paragraph({ text: "" })],
                          }),

                          new TableCell({
                            verticalAlign: "center",
                            margins: {
                              left: 200,   // left padding
                              top: 150,    // extra spacing above
                              bottom: 150, // extra spacing below
                            },
                            children: ev.subs.map(
                              (s) =>
                                new Paragraph({
                                  spacing: {
                                    before: 80,
                                    after: 80,
                                  },
                                  children: [
                                    new TextRun({
                                      text: `• ${s.time} – ${s.title}`,
                                      size: 22,
                                    }),
                                  ],
                                })
                            ),
                          }),
                        ],
                      })
                    );
                  }

                  return rows;
                }),
              ],
            }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
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
      const [hh, mm] = ev.time.split(":");
      const start = `${y}${m}${d}T${hh}${mm}00`;
      const endParts = formatTime(
        addMinutes(parseTime(ev.time), 15)
      ).split(":");
      const end = `${y}${m}${d}T${endParts[0]}${endParts[1]}00`;

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
      type: "text/calendar;charset=utf-8"
    });
    saveAs(blob, "agenda.ics");
  };

  const pageBg = darkMode
    ? "bg-slate-950 text-slate-100"
    : "bg-[#f5e9d8] text-slate-900";
  const cardBg = darkMode
    ? "bg-slate-900/80 border-slate-700"
    : "bg-white/90 border-amber-200";
  const subBg = darkMode
    ? "bg-slate-950 border-slate-700"
    : "bg-amber-50 border-amber-200";

  return (
    <div className={darkMode ? "dark" : ""}>
      <div
        className={`${pageBg} min-h-screen flex items-center justify-center px-3 py-6 sm:px-6`}
      >
        <div className="w-full max-w-4xl">
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
                  <div className="flex flex-wrap items-end gap-3 sm:gap-4">
                    <div className="flex items-start pt-1">
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
                          onChange={(e) =>
                            changeEventTime(idx, e.target.value)
                          }
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
                          onChange={(e) =>
                            updateEvent(idx, { title: e.target.value })
                          }
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
                        className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs sm:text-sm hover:opacity-90 transition border-blue-500/60 text-blue-600 dark:border-blue-400/60 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-950/30"
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

                  {ev.subs.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {ev.subs.map((sub, si) => (
                        <div
                          key={sub.id}
                          draggable
                          onDragStart={(e) => handleSubDragStart(e, ev.id, sub.id)}
                          onDragOver={handleSubDragOver}
                          onDrop={(e) => handleSubDrop(e, ev.id, sub.id)}
                          onDragEnd={handleSubDragEnd}
                          className={`flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl border px-3 sm:px-4 py-2 ${subBg} ${
                            draggingSub && draggingSub.subId === sub.id
                              ? "opacity-70 scale-[0.99]"
                              : ""
                          }`}
                        >
                          <span className="cursor-grab text-lg leading-none select-none">
                            ≡
                          </span>

                          <div className="w-24 sm:w-28">
                            <label className="text-[10px] uppercase tracking-wide opacity-60">
                              Uhrzeit
                            </label>
                            <input
                              type="time"
                              value={sub.time}
                              onChange={(e) =>
                                changeSubTime(idx, si, e.target.value)
                              }
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

            <div className="pt-2 flex justify-center">
              <button
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-full shadow-md text-sm font-medium transition"
                onClick={addEventAtEnd}
              >
                <span className="text-lg leading-none">+</span>
                Element hinzufügen
              </button>
            </div>

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

            <footer className="mt-4 pt-4 border-t border-black/10 dark:border-slate-700 text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-500 dark:text-slate-400">
              <span>
                © {new Date().getFullYear()} · Made with{" "}
                <span className="text-red-500">♥</span> by Tsvetina
              </span>
              <a
                href="www.linkedin.com/in/tsvetina-a-a292a41b4"
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-4 hover:text-blue-600 dark:hover:text-blue-400"
              >
                Connect on LinkedIn
              </a>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
