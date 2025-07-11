"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Cookies from "js-cookie";
import html2canvas from "html2canvas";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import jsPDF from "jspdf";
import CryptoJS from "crypto-js";

const initialState = {
  projectName: "",
  departmentName: "",
  startDate: "",
  endDate: "",
  startTime: "",
  endTime: "",
  purpose: "",
  description: "",
  email: "",
};

const regex = {
  text: /^(?!.*(<|>|script|http|www|\.com|@)).{1,50}$/i,
  desc: /^(?!.*(<|>|script|http|www|\.com)).{0,200}$/i,
  email: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
};

const weekdayColors = [
  "text-green-600", // Sunday
  "text-blue-600", // Monday
  "text-orange-500", // Tuesday
  "text-yellow-600", // Wednesday
  "text-pink-500", // Thursday
  "text-amber-700", // Friday
  "text-purple-600", // Saturday
];
const weekdayBg = [
  "bg-green-100", // Sunday
  "bg-blue-100", // Monday
  "bg-orange-100", // Tuesday
  "bg-yellow-100", // Wednesday
  "bg-pink-100", // Thursday
  "bg-amber-100", // Friday
  "bg-purple-100", // Saturday
];

const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const ampm = ["AM", "PM"];

const departmentOptions = ["IT", "Mines and minerals", "Management", "BioInformatices"];

const secretKey = "your-strong-secret-key"; // Change this to a strong, private key

// CustomDropdown component
function CustomDropdown({ options, value, onChange, label, width = '100%' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    function handleEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
    <div className="relative" style={{ width: typeof width === 'number' ? width : undefined }} ref={ref}>
      <button
        type="button"
        className={`w-full px-3 py-2 border border-gray-200 rounded-xl text-left bg-white focus:border-[#7d92a7] focus:shadow-md transition-all duration-150 ${open ? "ring-2 ring-[#7d92a7]" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={value ? "text-black font-semibold" : "text-gray-400"}>{value || label}</span>
        <span className="float-right">▼</span>
      </button>
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-auto" style={{background: 'linear-gradient(135deg, #f8fafc 80%, #e0e7ef 100%)'}} role="listbox">
          {options.map((opt) => (
            <li
              key={opt}
              className={`px-3 py-2 cursor-pointer transition-all duration-100 
                ${value === opt ? "bg-gradient-to-r from-[#7d92a7] to-[#586364] text-white font-bold" : "bg-transparent text-black hover:bg-blue-100"}`}
              onClick={() => { onChange(opt); setOpen(false); }}
              role="option"
              aria-selected={value === opt}
              tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter") { onChange(opt); setOpen(false); }}}
            >
              {opt}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Home() {
  const [form, setForm] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false); // NEW
  const [timeSelect, setTimeSelect] = useState({ hour: "", minute: "", ampm: "" });
  const [endTimeSelect, setEndTimeSelect] = useState({ hour: "", minute: "", ampm: "" }); // NEW
  const ticketRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showBookings, setShowBookings] = useState(false);
  const [bookings, setBookings] = useState([]);
  // Add state for slot conflict warning
  const [slotConflict, setSlotConflict] = useState(false);
  // Add state for start time overlap warning
  const [startTimeOverlap, setStartTimeOverlap] = useState(false);
  // Add state for Start Time disabled message
  const [showStartTimeDisabledMsg, setShowStartTimeDisabledMsg] = useState(false);
  // Add state for End Time disabled message
  const [showEndTimeDisabledMsg, setShowEndTimeDisabledMsg] = useState(false);
  // Add state for conflicting dates
  const [conflictingDates, setConflictingDates] = useState([]);
  // Add state for grouped conflicts
  const [groupedConflicts, setGroupedConflicts] = useState({});

  // On mount, try to decrypt and load form data from cookie (only if not just booked)
  useEffect(() => {
    if (!success) {
      const encryptedData = Cookies.get("slotBooking");
      if (encryptedData) {
        try {
          const bytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
          const decrypted = bytes.toString(CryptoJS.enc.Utf8);
          if (decrypted) {
            const parsed = JSON.parse(decrypted);
            setForm((prev) => ({ ...prev, ...parsed }));
          }
        } catch (err) {
          Cookies.remove("slotBooking");
        }
      }
    }
  }, [success]);

  // Load all bookings from cookies for the modal
  useEffect(() => {
    const encryptedList = Cookies.get("slotBookingList");
    if (encryptedList) {
      try {
        const bytes = CryptoJS.AES.decrypt(encryptedList, secretKey);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (decrypted) {
          const parsed = JSON.parse(decrypted);
          // Filter to only last 1 month
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          const filtered = parsed.filter(b => new Date(b.startDate) >= oneMonthAgo);
          // Sort newest first by createdAt
          filtered.sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate));
          setBookings(filtered);
        }
      } catch {}
    } else {
      setBookings([]);
    }
  }, [showBookings, success]);

  // Helper to check overlap between two date ranges
  function dateRangesOverlap(start1, end1, start2, end2) {
    return !(new Date(end1) < new Date(start2) || new Date(start1) > new Date(end2));
  }
  // Helper to check overlap between two time ranges (can cross midnight)
  function timeRangesOverlap(start1, end1, start2, end2) {
    // Convert to minutes since midnight
    function toMins(t) {
      const m = t.match(/(\d{2}):(\d{2})\s?(AM|PM)/i);
      if (!m) return null;
      let h = parseInt(m[1], 10) % 12 + (m[3].toUpperCase() === 'PM' ? 12 : 0);
      let min = parseInt(m[2], 10);
      return h * 60 + min;
    }
    let s1 = toMins(start1), e1 = toMins(end1), s2 = toMins(start2), e2 = toMins(end2);
    if (e1 <= s1) e1 += 24 * 60;
    if (e2 <= s2) e2 += 24 * 60;
    // Overlap if ranges intersect
    return (s1 < e2 && s2 < e1);
  }
  // Helper to check if a slot (start, end) overlaps with any existing booking
  function slotOverlapsAny(startDate, endDate, startTime, endTime, bookings) {
    return bookings.some(b => {
      if (!b.startDate || !b.endDate || !b.startTime || !b.endTime) return false;
      if (!dateRangesOverlap(startDate, endDate, b.startDate, b.endDate)) return false;
      return timeRangesOverlap(startTime, endTime, b.startTime, b.endTime);
    });
  }
  // Helper to check overlap for a single date
  function slotOverlapsOnDate(date, startTime, endTime, bookings) {
    return bookings.some(b => {
      if (!b.startDate || !b.endDate || !b.startTime || !b.endTime) return false;
      // Only check for overlap if the booking includes the date
      if (date < b.startDate || date > b.endDate) return false;
      return timeRangesOverlap(startTime, endTime, b.startTime, b.endTime);
    });
  }
  // Helper: get all dates between two dates (inclusive)
  function getDatesBetween(start, end) {
    const dates = [];
    let current = new Date(start);
    const endDate = new Date(end);
    while (current <= endDate) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }
  // Refactor slot conflict check for multi-day bookings
  useEffect(() => {
    if (!form.startDate || !form.endDate || !form.startTime || !form.endTime) {
      setSlotConflict(false);
      setConflictingDates([]);
      setGroupedConflicts({});
      return;
    }
    const encryptedList = Cookies.get("slotBookingList");
    if (!encryptedList) {
      setSlotConflict(false);
      setConflictingDates([]);
      setGroupedConflicts({});
      return;
    }
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedList, secretKey);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (!decrypted) {
        setSlotConflict(false);
        setConflictingDates([]);
        setGroupedConflicts({});
        return;
      }
      const bookings = JSON.parse(decrypted);
      const newDates = getDatesBetween(form.startDate, form.endDate);
      let conflict = false;
      for (const b of bookings) {
        if (!b.startDate || !b.endDate || !b.startTime || !b.endTime) continue;
        // Find overlapping dates between new booking and existing booking
        const existingDates = getDatesBetween(b.startDate, b.endDate);
        const overlapDates = newDates.filter(d => existingDates.includes(d));
        for (const d of overlapDates) {
          // Only check time overlap on overlapping dates
          if (timeRangesOverlap(form.startTime, form.endTime, b.startTime, b.endTime)) {
            conflict = true;
            break;
          }
        }
        if (conflict) break;
      }
      setSlotConflict(conflict);
    } catch {
      setSlotConflict(false);
      setConflictingDates([]);
      setGroupedConflicts({});
    }
  }, [form.startDate, form.endDate, form.startTime, form.endTime]);

  // Refactor slot conflict check for grouped warning
  useEffect(() => {
    if (!form.startDate || !form.endDate || !form.startTime || !form.endTime) {
      setSlotConflict(false);
      setConflictingDates([]);
      setGroupedConflicts({});
      return;
    }
    const encryptedList = Cookies.get("slotBookingList");
    if (!encryptedList) {
      setSlotConflict(false);
      setConflictingDates([]);
      setGroupedConflicts({});
      return;
    }
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedList, secretKey);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      if (!decrypted) {
        setSlotConflict(false);
        setConflictingDates([]);
        setGroupedConflicts({});
        return;
      }
      const bookings = JSON.parse(decrypted);
      const newDates = getDatesBetween(form.startDate, form.endDate);
      let conflicts = [];
      let grouped = {};
      for (const d of newDates) {
        for (const b of bookings) {
          if (!b.startDate || !b.endDate || !b.startTime || !b.endTime) continue;
          if (d >= b.startDate && d <= b.endDate) {
            if (timeRangesOverlap(form.startTime, form.endTime, b.startTime, b.endTime)) {
              conflicts.push(d);
              const slotKey = `${b.startTime} - ${b.endTime}`;
              if (!grouped[slotKey]) grouped[slotKey] = [];
              grouped[slotKey].push(d);
            }
          }
        }
      }
      setSlotConflict(conflicts.length > 0);
      setConflictingDates(conflicts);
      setGroupedConflicts(grouped);
    } catch {
      setSlotConflict(false);
      setConflictingDates([]);
      setGroupedConflicts({});
    }
  }, [form.startDate, form.endDate, form.startTime, form.endTime]);

  const validate = () => {
    let errs = {};
    if (!regex.text.test(form.projectName)) errs.projectName = "Invalid project name.";
    if (!departmentOptions.includes(form.departmentName)) errs.departmentName = "Please select a department.";
    if (!form.startDate) errs.startDate = "Start date required.";
    if (!form.endDate) errs.endDate = "End date required.";
    if (!form.startTime) errs.startTime = "Start time required.";
    if (!form.endTime) errs.endTime = "End time required.";
    if (slotConflict) errs.startTime = errs.endTime = "This slot overlaps with an existing booking.";
    // Validate endTime is at least 5 minutes after startTime, allow cross-midnight
    if (form.startTime && form.endTime) {
      const [sh, sm, sap] = form.startTime.match(/(\d{2}):(\d{2})\s?(AM|PM)/i).slice(1);
      const [eh, em, eap] = form.endTime.match(/(\d{2}):(\d{2})\s?(AM|PM)/i).slice(1);
      let sHour = parseInt(sh, 10) % 12 + (sap === "PM" ? 12 : 0);
      let sMin = parseInt(sm, 10);
      let eHour = parseInt(eh, 10) % 12 + (eap === "PM" ? 12 : 0);
      let eMin = parseInt(em, 10);
      let startMins = sHour * 60 + sMin;
      let endMins = eHour * 60 + eMin;
      // If End Time is AM and Start Time is PM or End Time is numerically less, treat as next day
      if (endMins <= startMins) endMins += 24 * 60;
      if (endMins - startMins < 5) errs.endTime = "End time must be at least 5 minutes after start time.";
      if (endMins - startMins > 12 * 60) errs.endTime = "End time must be within 12 hours of start time.";
    }
    if (!regex.text.test(form.purpose)) errs.purpose = "Invalid purpose.";
    if (!regex.desc.test(form.description)) errs.description = "Invalid description.";
    if (!regex.email.test(form.email)) errs.email = "Invalid email.";
    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "description") {
      // Limit to 100 words
      const words = value.trim().split(/\s+/);
      if (words.length > 100) return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePaste = (e) => {
    e.preventDefault();
  };

  const handleStartDateSelect = (date) => {
    if (date) {
      // Fix: Use local date string (YYYY-MM-DD) to avoid timezone issues
      const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      setForm((prev) => ({ ...prev, startDate: localDate }));
      setShowStartDate(false);
    }
  };

  const handleEndDateSelect = (date) => {
    if (date) {
      if (form.startDate) {
        const start = form.startDate;
        const end = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (end < start) {
          alert("End date cannot be before start date!");
          return;
        }
        setForm((prev) => ({ ...prev, endDate: end }));
        setShowEndDate(false);
      } else {
        const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        setForm((prev) => ({ ...prev, endDate: localDate }));
        setShowEndDate(false);
      }
    }
  };

  const handleTimeSelect = () => {
    if (timeSelect.hour && timeSelect.minute && timeSelect.ampm) {
      // Check for overlap with existing bookings for this start time
      let bookings = [];
      const encryptedList = Cookies.get("slotBookingList");
      if (encryptedList) {
        try {
          const bytes = CryptoJS.AES.decrypt(encryptedList, secretKey);
          const decrypted = bytes.toString(CryptoJS.enc.Utf8);
          if (decrypted) bookings = JSON.parse(decrypted);
        } catch {}
      }
      const selectedStartTime = `${timeSelect.hour}:${timeSelect.minute} ${timeSelect.ampm}`;
      let overlap = false;
      if (form.startDate) {
        overlap = bookings.some(b => {
          if (!b.startDate || !b.endDate || !b.startTime || !b.endTime) return false;
          if (form.startDate < b.startDate || form.startDate > b.endDate) return false;
          // Check if selected start time overlaps with any booking on this date
          return timeRangesOverlap(selectedStartTime, b.endTime, b.startTime, b.endTime);
        });
      }
      setStartTimeOverlap(overlap);
      if (!overlap) {
        setForm((prev) => ({ ...prev, startTime: selectedStartTime }));
        setShowTime(false);
        // Reset end time if start time changes
        setForm((prev) => ({ ...prev, endTime: "" }));
        setEndTimeSelect({ hour: "", minute: "", ampm: "" });
      }
    }
  };
  // NEW: End Time select logic
  const handleEndTimeSelect = () => {
    if (endTimeSelect.hour && endTimeSelect.minute && endTimeSelect.ampm) {
      setForm((prev) => ({ ...prev, endTime: `${endTimeSelect.hour}:${endTimeSelect.minute} ${endTimeSelect.ampm}` }));
      setShowEndTime(false);
    }
  };
  const handleEndTimeDropdown = (e) => {
    const { name, value } = e.target;
    setEndTimeSelect((prev) => ({ ...prev, [name]: value }));
  };

  // Update: Run overlap check on dropdown change
  const handleTimeDropdown = (e) => {
    const { name, value } = e.target || {};
    let newTimeSelect = { ...timeSelect };
    if (name) newTimeSelect[name] = value;
    // If using CustomDropdown, value is passed directly
    if (!name && typeof value === 'string') {
      // Try to infer which field changed
      if (hours.includes(value)) newTimeSelect.hour = value;
      else if (minutes.includes(value)) newTimeSelect.minute = value;
      else if (ampm.includes(value)) newTimeSelect.ampm = value;
    }
    setTimeSelect(newTimeSelect);
    // Check overlap immediately
    if (newTimeSelect.hour && newTimeSelect.minute && newTimeSelect.ampm) {
      let bookings = [];
      const encryptedList = Cookies.get("slotBookingList");
      if (encryptedList) {
        try {
          const bytes = CryptoJS.AES.decrypt(encryptedList, secretKey);
          const decrypted = bytes.toString(CryptoJS.enc.Utf8);
          if (decrypted) bookings = JSON.parse(decrypted);
        } catch {}
      }
      const selectedStartTime = `${newTimeSelect.hour}:${newTimeSelect.minute} ${newTimeSelect.ampm}`;
      let overlap = false;
      if (form.startDate) {
        overlap = bookings.some(b => {
          if (!b.startDate || !b.endDate || !b.startTime || !b.endTime) return false;
          if (form.startDate < b.startDate || form.startDate > b.endDate) return false;
          return timeRangesOverlap(selectedStartTime, b.endTime, b.startTime, b.endTime);
        });
      }
      setStartTimeOverlap(overlap);
    } else {
      setStartTimeOverlap(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      setLoading(false);
      return;
    }
    // Encrypt form data before storing in cookies (for prefill)
    const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(form), secretKey).toString();
    Cookies.set("slotBooking", encryptedData, { expires: 7 });
    // Store in booking list (array of bookings)
    let bookingList = [];
    const encryptedList = Cookies.get("slotBookingList");
    if (encryptedList) {
      try {
        const bytes = CryptoJS.AES.decrypt(encryptedList, secretKey);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (decrypted) {
          bookingList = JSON.parse(decrypted);
        }
      } catch {}
    }
    // Always add createdAt
    bookingList.push({ ...form, createdAt: new Date().toISOString() });
    // Only keep last 1 month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    bookingList = bookingList.filter(b => new Date(b.startDate) >= oneMonthAgo);
    // Sort newest first by createdAt
    bookingList.sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate));
    const encryptedListNew = CryptoJS.AES.encrypt(JSON.stringify(bookingList), secretKey).toString();
    Cookies.set("slotBookingList", encryptedListNew, { expires: 31 });
    const res = await fetch("/api/book-slot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setSuccess(true);
      setTicket({ ...form });
      // Clear form for next booking
      setForm(initialState);
      Cookies.remove("slotBooking");
    }
    setLoading(false);
  };

  // Back to form and clear
  const handleBackToForm = () => {
    setSuccess(false);
    setTicket(null);
    setForm(initialState);
    Cookies.remove("slotBooking");
  };

  // Clear form function
  const handleClearForm = () => {
    setForm(initialState);
    setErrors({});
    setTimeSelect({ hour: "", minute: "", ampm: "" });
    setEndTimeSelect({ hour: "", minute: "", ampm: "" });
    Cookies.remove("slotBooking");
  };

  // Helper to format booking number
  function getBookingNumber(startDate, startTime, endTime) {
    if (!startDate || !startTime || !endTime) return '';
    const d = new Date(startDate);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    let [sh, smin, sampm] = ["", "", ""];
    let [eh, emin, eampm] = ["", "", ""];
    const smatch = startTime.match(/(\d{2}):(\d{2})\s?(AM|PM)/i);
    const ematch = endTime.match(/(\d{2}):(\d{2})\s?(AM|PM)/i);
    if (smatch) {
      sh = smatch[1];
      smin = smatch[2];
      sampm = smatch[3].toUpperCase();
    }
    if (ematch) {
      eh = ematch[1];
      emin = ematch[2];
      eampm = ematch[3].toUpperCase();
    }
    // Example: AAS110725S1105E1215 (S=start, E=end)
    return `AAS${dd}${mm}${yy}S${sampm}${sh}${smin}E${eampm}${eh}${emin}`;
  }

  // Helper to calculate duration between two times (can cross midnight)
  function getSlotDuration(start, end) {
    if (!start || !end) return null;
    const [sh, sm, sap] = start.match(/(\d{2}):(\d{2})\s?(AM|PM)/i).slice(1);
    const [eh, em, eap] = end.match(/(\d{2}):(\d{2})\s?(AM|PM)/i).slice(1);
    let sHour = parseInt(sh, 10) % 12 + (sap === "PM" ? 12 : 0);
    let sMin = parseInt(sm, 10);
    let eHour = parseInt(eh, 10) % 12 + (eap === "PM" ? 12 : 0);
    let eMin = parseInt(em, 10);
    let startMins = sHour * 60 + sMin;
    let endMins = eHour * 60 + eMin;
    if (endMins <= startMins) endMins += 24 * 60;
    let diff = endMins - startMins;
    if (diff < 0) return null;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return { hours, mins };
  }

  function formatSlotDuration(start, end) {
    const dur = getSlotDuration(start, end);
    if (!dur) return null;
    let str = "";
    if (dur.hours > 0) str += `<b>${dur.hours} hour${dur.hours > 1 ? 's' : ''}</b> `;
    if (dur.mins > 0) str += `<b>${dur.mins} minute${dur.mins > 1 ? 's' : ''}</b>`;
    return str.trim();
  }

  // Helper to get the latest end time for a date from existing bookings
  function getLatestEndTimeForDate(date, bookings) {
    let latest = null;
    bookings.forEach(b => {
      if (!b.startDate || !b.endDate || !b.startTime || !b.endTime) return;
      if (date < b.startDate || date > b.endDate) return;
      // Convert end time to minutes
      const m = b.endTime.match(/(\d{2}):(\d{2})\s?(AM|PM)/i);
      if (!m) return;
      let h = parseInt(m[1], 10) % 12 + (m[3].toUpperCase() === 'PM' ? 12 : 0);
      let min = parseInt(m[2], 10);
      let mins = h * 60 + min;
      if (latest === null || mins > latest) latest = mins;
    });
    return latest;
  }

  const handleSaveTicket = async (asPdf = false) => {
    if (!ticket) return;
    setSaved(false);
    if (asPdf) {
      // Generate PDF directly with jsPDF
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      let y = 50;
      // Gradient header (simulate with two rectangles)
      pdf.setFillColor(125, 146, 167); // #7d92a7
      pdf.rect(0, 0, 297, 80, 'F');
      pdf.setFillColor(125, 146, 167); // #586364
      pdf.rect(297, 0, 298, 80, 'F');
      pdf.setFontSize(24);
      pdf.setTextColor('#d1c061'); // gold heading
      pdf.text('Time Slot Book', 300, y, { align: 'center' });
      y += 60;
      pdf.setFontSize(18);
      pdf.setTextColor('#7d92a7');
      pdf.text('Your Slot Booking Successful !', 60, y);
      y += 28;
      pdf.setFontSize(12);
      pdf.setTextColor('#7d92a7');
      pdf.text(`Booking No: ${getBookingNumber(ticket.startDate, ticket.startTime, ticket.endTime)}`, 60, y);
      y += 30;
      pdf.setFontSize(13);
      pdf.setTextColor('#111');
      const labelWidth = 110;
      pdf.text('Project Name:', 60, y);
      pdf.text(`${ticket.projectName}`, 60 + labelWidth, y);
      y += 24;
      pdf.text('Department Name:', 60, y);
      pdf.text(`${ticket.departmentName}`, 60 + labelWidth, y);
      y += 24;
      pdf.text('Start Date:', 60, y);
      pdf.text(`${ticket.startDate}`, 60 + labelWidth, y);
      y += 24;
      pdf.text('End Date:', 60, y);
      pdf.text(`${ticket.endDate}`, 60 + labelWidth, y);
      y += 24;
      pdf.text('Time:', 60, y);
      pdf.text(`${ticket.startTime && ticket.endTime ? ticket.startTime + ' - ' + ticket.endTime : '-'}`, 60 + labelWidth, y);
      y += 24;
      pdf.text('Purpose:', 60, y);
      pdf.text(`${ticket.purpose}`, 60 + labelWidth, y);
      y += 24;
      pdf.text('Description:', 60, y);
      pdf.text(`${ticket.description}`, 60 + labelWidth, y);
      y += 24;
      pdf.text('Email:', 60, y);
      pdf.text(`${ticket.email}`, 60 + labelWidth, y);
      pdf.save('slot-booking-ticket.pdf');
      setSaved(true);
      return;
    }
    // ...existing image save logic (if needed)...
  };

  // Hide the message if Start Date is selected
  useEffect(() => {
    if (form.startDate) setShowStartTimeDisabledMsg(false);
  }, [form.startDate]);

  // Hide the message if Start Date or Start Time is selected
  useEffect(() => {
    if (form.startDate && form.startTime) setShowEndTimeDisabledMsg(false);
  }, [form.startDate, form.startTime]);

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center py-8">
      <div className="w-full max-w-4xl md:mx-0 mx-2 sm:mx-4 max-w-sm sm:max-w-md md:max-w-4xl bg-white rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden">
        {/* Left minor section */}
        <div className="w-full md:w-1/3 min-w-[120px] flex flex-col items-center justify-center bg-gradient-to-br from-[#7d92a7] to-[#586364] p-6 md:p-8 relative md:min-h-[600px] min-h-[180px]">
          <div className="flex flex-col items-center justify-center w-full h-full">
            <Image src="/aaslogo.png" alt="Company Logo" width={100} height={100} className="mb-3 md:mb-6 md:w-[100px] md:h-[100px] w-[60px] h-[60px]" style={{objectFit: 'contain'}} />
            <h2 className="text-lg md:text-2xl font-bold text-center bg-gradient-to-r from-[#d1c061] via-[#e6c068] to-[#c4b667] bg-clip-text text-transparent mb-1 md:mb-2">Time Slot Book</h2>
          </div>
          {/* <div className="w-full text-center absolute bottom-2 left-0 text-[11px] text-[#c0bf73] font-light select-none">
            @ 2025 copyright reserved AAS Information Technology
          </div> */}
        </div>
        {/* Right major section */}
        <div className="w-full md:w-2/3 flex flex-col items-center justify-center px-4 md:px-8 py-8 md:py-12 relative">
          {/* View Booked Slots button */}
          <button
            className="absolute  top-4 right-7  text-xs md:text-sm bg-gradient-to-r from-[#7d92a7] to-[#586364] hover:from-green-500 hover:to-green-800 text-white px-3 py-2 rounded shadow hover:scale-105 transition"
            onClick={() => setShowBookings(true)}
            type="button"
          >
            View Booked Slots
          </button>
          <div className="w-full max-w-xl">
            {!success ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:gap-4 w-full">
                <div>
                  <label className="block font-medium mb-1 text-black">Project Name</label>
                  <input
                    type="text"
                    name="projectName"
                    value={form.projectName}
                    onChange={handleChange}
                    onPaste={handlePaste}
                    className="w-full px-3 py-2 bg-gray-100 text-black outline-none border border-gray-200 focus:border-[#7d92a7] focus:shadow-md transition-all duration-150 rounded-xl"
                    maxLength={50}
                    autoComplete="off"
                    required
                    placeholder="Enter project name"
                  />
                  {errors.projectName && <p className="text-red-500 text-xs mt-1">{errors.projectName}</p>}
                </div>
                <div>
                  <label className="block font-medium mb-1 text-black">Department Name</label>
                  <CustomDropdown
                    options={departmentOptions}
                    value={form.departmentName}
                    onChange={val => setForm(prev => ({ ...prev, departmentName: val }))}
                    label="Select Department"
                    width="100%"
                  />
                  {errors.departmentName && <p className="text-red-500 text-xs mt-1">{errors.departmentName}</p>}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block font-medium mb-1 text-black">Start Date</label>
                    {form.startDate ? (
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-2 bg-gray-100 text-black border border-gray-200 rounded w-full flex items-center justify-between">
                          <span>{new Date(form.startDate).toLocaleDateString()}</span>
                          <button type="button" className="text-xs text-[#A259F7] underline ml-2" onClick={() => setShowStartDate(true)}>Change</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowStartDate(true)}
                        className="w-full px-3 py-2 bg-gray-100 text-gray-400 text-left outline-none border border-gray-200 focus:border-[#7d92a7] focus:shadow-md rounded-xl transition-all duration-150"
                      >
                        Select Start Date
                      </button>
                    )}
                    {showStartDate && (
                      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
                        <div className="bg-white text-black p-4 rounded-xl shadow-lg z-50">
                          <DayPicker
                            mode="single"
                            selected={form.startDate ? new Date(form.startDate) : undefined}
                            onSelect={handleStartDateSelect}
                            modifiersClassNames={{
                              selected: "bg-[#F7B32B] text-black rounded-md",
                              today: "border-0",
                              hover: "ring-2 ring-[#A259F7]",
                            }}
                            showOutsideDays
                            disabled={{ before: new Date() }}
                          />
                          <button className="mt-2 px-4 py-1 rounded bg-[#A259F7] text-white" onClick={() => setShowStartDate(false)} type="button">Close</button>
                        </div>
                      </div>
                    )}
                    {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>}
                  </div>
                  <div className="flex-1">
                    <label className="block font-medium mb-1 text-black">End Date</label>
                    {form.endDate ? (
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-2 bg-gray-100 text-black border border-gray-200 rounded w-full flex items-center justify-between">
                          <span>{new Date(form.endDate).toLocaleDateString()}</span>
                          <button type="button" className="text-xs text-[#A259F7] underline ml-2" onClick={() => setShowEndDate(true)}>Change</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowEndDate(true)}
                        className="w-full px-3 py-2 bg-gray-100 text-gray-400 text-left outline-none border border-gray-200 focus:border-[#7d92a7] focus:shadow-md rounded-xl transition-all duration-150"
                      >
                        Select End Date
                      </button>
                    )}
                    {showEndDate && (
                      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
                        <div className="bg-white text-black p-4 rounded-xl shadow-lg z-50">
                          <DayPicker
                            mode="single"
                            selected={form.endDate ? new Date(form.endDate) : undefined}
                            onSelect={handleEndDateSelect}
                            modifiersClassNames={{
                              selected: "bg-[#F7B32B] text-black rounded-md",
                              today: "border-0",
                              hover: "ring-2 ring-[#A259F7]",
                            }}
                            showOutsideDays
                            disabled={{
                              before: form.startDate ? new Date(form.startDate) : new Date(),
                            }}
                          />
                          <button className="mt-2 px-4 py-1 rounded bg-[#A259F7] text-white" onClick={() => setShowEndDate(false)} type="button">Close</button>
                        </div>
                      </div>
                    )}
                    {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block font-medium mb-1 text-black">Start Time</label>
                    {form.startTime ? (
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-2 bg-gray-100 text-black border border-gray-200 rounded w-full flex items-center justify-between">
                          <span>{form.startTime}</span>
                          <button type="button" className="text-xs text-[#F76D6D] underline ml-2" onClick={() => setShowTime(true)}>Change</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!form.startDate) {
                            setShowStartTimeDisabledMsg(true);
                            setTimeout(() => setShowStartTimeDisabledMsg(false), 2500);
                          } else {
                            setShowTime(true);
                          }
                        }}
                        className={`w-full px-3 py-2 bg-gray-100 text-gray-400 text-left outline-none border border-gray-200 focus:border-[#7d92a7] focus:shadow-md rounded-xl transition-all duration-150 ${!form.startDate ? 'opacity-60 cursor-not-allowed' : ''}`}
                        style={!form.startDate ? { pointerEvents: 'auto' } : {}}
                      >
                        Select Start Time
                      </button>
                    )}
                    {showStartTimeDisabledMsg && (
                      <div className="text-xs text-red-600 font-semibold mt-1">Please select Start Date first.</div>
                    )}
                    {showTime && (() => {
                      let bookings = [];
                      const encryptedList = Cookies.get("slotBookingList");
                      if (encryptedList) {
                        try {
                          const bytes = CryptoJS.AES.decrypt(encryptedList, secretKey);
                          const decrypted = bytes.toString(CryptoJS.enc.Utf8);
                          if (decrypted) bookings = JSON.parse(decrypted);
                        } catch {}
                      }
                      let hasValidStart = false;
                      let validHours = [];
                      let validMinutes = [];
                      // Always show both AM and PM
                      let validAmpm = ["AM", "PM"];
                      let latestEndMins = form.startDate ? getLatestEndTimeForDate(form.startDate, bookings) : null;
                      if (form.startDate) {
                        for (let h = 0; h < 24; h++) {
                          for (let m = 0; m < 60; m += 5) {
                            let hour12 = h % 12 === 0 ? 12 : h % 12;
                            let ampmVal = h < 12 ? "AM" : "PM";
                            const val = `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampmVal}`;
                            // Convert this start time to minutes
                            let mins = h * 60 + m;
                            // Only allow if after latest end time (or if no bookings, allow all)
                            if (latestEndMins === null || mins > latestEndMins) {
                              // Check for overlap with existing bookings for this start time
                              let overlap = false;
                              if (form.startDate) {
                                overlap = bookings.some(b => {
                                  if (!b.startDate || !b.endDate || !b.startTime || !b.endTime) return false;
                                  if (form.startDate < b.startDate || form.startDate > b.endDate) return false;
                                  return timeRangesOverlap(val, b.endTime, b.startTime, b.endTime);
                                });
                              }
                              if (!overlap) {
                                hasValidStart = true;
                                if (!validHours.includes(String(hour12).padStart(2, "0"))) validHours.push(String(hour12).padStart(2, "0"));
                                if (!validMinutes.includes(String(m).padStart(2, "0"))) validMinutes.push(String(m).padStart(2, "0"));
                              }
                            }
                          }
                        }
                      }
                      return (
                        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
                          <div className="bg-white p-4 rounded-xl shadow-lg z-50 min-w-[260px]">
                            <div className="flex gap-2 mb-2">
                              <CustomDropdown
                                options={hours.filter(hh => validHours.includes(hh))}
                                value={timeSelect.hour}
                                onChange={val => handleTimeDropdown({ target: { name: 'hour', value: val } })}
                                label="HH"
                                disabled={!hasValidStart}
                              />
                              <span className="text-black font-bold">:</span>
                              <CustomDropdown
                                options={minutes.filter(mm => validMinutes.includes(mm))}
                                value={timeSelect.minute}
                                onChange={val => handleTimeDropdown({ target: { name: 'minute', value: val } })}
                                label="MM"
                                disabled={!hasValidStart}
                              />
                              <CustomDropdown
                                options={validAmpm}
                                value={timeSelect.ampm}
                                onChange={val => handleTimeDropdown({ target: { name: 'ampm', value: val } })}
                                label="AM/PM"
                                disabled={!hasValidStart}
                              />
                            </div>
                            {!hasValidStart && (
                              <div className="text-sm text-red-600 font-semibold text-center mt-2">Warning: All possible start times for this date are blocked by existing bookings!</div>
                            )}
                            {startTimeOverlap && (
                              <div className="text-sm text-red-600 font-semibold text-center mt-2">Start time already booked, please choose another start time.</div>
                            )}
                            <button
                              className="px-4 py-1 rounded bg-[#F76D6D] text-white mr-2"
                              type="button"
                              onClick={handleTimeSelect}
                              disabled={!(timeSelect.hour && timeSelect.minute && timeSelect.ampm) || !hasValidStart || startTimeOverlap}
                            >
                              Set Time
                            </button>
                            <button className="px-4 py-1 rounded bg-gray-300 text-black" onClick={() => { setShowTime(false); setStartTimeOverlap(false); }} type="button">Close</button>
                          </div>
                        </div>
                      );
                    })()}
                    {errors.startTime && <p className="text-red-500 text-xs mt-1">{errors.startTime}</p>}
                  </div>
                  <div className="flex-1">
                    <label className="block font-medium mb-1 text-black">End Time</label>
                    {form.endTime ? (
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-2 bg-gray-100 text-black border border-gray-200 rounded w-full flex items-center justify-between">
                          <span>{form.endTime}</span>
                          <button type="button" className="text-xs text-[#F76D6D] underline ml-2" onClick={() => setShowEndTime(true)}>Change</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!form.startDate || !form.startTime) {
                            setShowEndTimeDisabledMsg(true);
                            setTimeout(() => setShowEndTimeDisabledMsg(false), 2500);
                          } else {
                            setShowEndTime(true);
                          }
                        }}
                        className={`w-full px-3 py-2 bg-gray-100 text-gray-400 text-left outline-none border border-gray-200 focus:border-[#7d92a7] focus:shadow-md rounded-xl transition-all duration-150 ${(!form.startDate || !form.startTime) ? 'opacity-60 cursor-not-allowed' : ''}`}
                        style={!form.startDate || !form.startTime ? { pointerEvents: 'auto' } : {}}
                      >
                        Select End Time
                      </button>
                    )}
                    {showEndTimeDisabledMsg && (
                      <div className="text-xs text-red-600 font-semibold mt-1">Please select Start Date and Start Time first.</div>
                    )}
                    {showEndTime && (() => {
                      let bookings = [];
                      const encryptedList = Cookies.get("slotBookingList");
                      if (encryptedList) {
                        try {
                          const bytes = CryptoJS.AES.decrypt(encryptedList, secretKey);
                          const decrypted = bytes.toString(CryptoJS.enc.Utf8);
                          if (decrypted) bookings = JSON.parse(decrypted);
                        } catch {}
                      }
                      let hasValid = false;
                      let validHours = [];
                      let validMinutes = [];
                      // Always show both AM and PM for End Time
                      let validAmpm = ["AM", "PM"];
                      if (form.startDate && form.startTime) {
                        const [sh, sm, sap] = form.startTime.match(/(\d{2}):(\d{2})\s?(AM|PM)/i).slice(1);
                        let sHour = parseInt(sh, 10) % 12 + (sap === "PM" ? 12 : 0);
                        let sMin = parseInt(sm, 10);
                        const startMins = sHour * 60 + sMin;
                        for (let h = 0; h < 24; h++) {
                          for (let m = 0; m < 60; m += 5) {
                            const mins = h * 60 + m;
                            if (mins > startMins) {
                              let hour12 = h % 12 === 0 ? 12 : h % 12;
                              let ampmVal = h < 12 ? "AM" : "PM";
                              const val = `${String(hour12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampmVal}`;
                              // Never allow Start Time == End Time
                              if (val === form.startTime) continue;
                              // Block if overlaps with any booking on the selected start date
                              if (!slotOverlapsOnDate(form.startDate, form.startTime, val, bookings)) {
                                hasValid = true;
                                if (!validHours.includes(String(hour12).padStart(2, "0"))) validHours.push(String(hour12).padStart(2, "0"));
                                if (!validMinutes.includes(String(m).padStart(2, "0"))) validMinutes.push(String(m).padStart(2, "0"));
                              }
                            }
                          }
                        }
                      }
                      return (
                        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
                          <div className="bg-white p-4 rounded-xl shadow-lg z-50 min-w-[260px]">
                            <div className="flex gap-2 mb-2">
                              <CustomDropdown
                                options={hours.filter(hh => validHours.includes(hh))}
                                value={endTimeSelect.hour}
                                onChange={val => handleEndTimeDropdown({ target: { name: 'hour', value: val } })}
                                label="HH"
                                disabled={!hasValid}
                              />
                              <span className="text-black font-bold">:</span>
                              <CustomDropdown
                                options={minutes.filter(mm => validMinutes.includes(mm))}
                                value={endTimeSelect.minute}
                                onChange={val => handleEndTimeDropdown({ target: { name: 'minute', value: val } })}
                                label="MM"
                                disabled={!hasValid}
                              />
                              <CustomDropdown
                                options={validAmpm}
                                value={endTimeSelect.ampm}
                                onChange={val => handleEndTimeDropdown({ target: { name: 'ampm', value: val } })}
                                label="AM/PM"
                                disabled={!hasValid}
                              />
                            </div>
                            {!hasValid && (
                              <div className="text-sm text-red-600 font-semibold text-center mt-2">Warning: All possible end times for this start time are blocked by existing bookings!</div>
                            )}
                            <button
                              className="px-4 py-1 rounded bg-[#F76D6D] text-white mr-2"
                              type="button"
                              onClick={handleEndTimeSelect}
                              disabled={!(endTimeSelect.hour && endTimeSelect.minute && endTimeSelect.ampm) || !hasValid}
                            >
                              Set Time
                            </button>
                            <button className="px-4 py-1 rounded bg-gray-300 text-black" onClick={() => setShowEndTime(false)} type="button">Close</button>
                          </div>
                        </div>
                      );
                    })()}
                    {errors.endTime && <p className="text-red-500 text-xs mt-1">{errors.endTime}</p>}
                  </div>
                </div>
                {form.startTime && form.endTime && (
                  <div className="text-sm font-bold mt-2 text-center bg-gradient-to-r from-[#7d92a7] to-[#F7B32B] bg-clip-text text-transparent drop-shadow-sm">
                    Total slot duration is -- <span dangerouslySetInnerHTML={{__html: formatSlotDuration(form.startTime, form.endTime)}} />
                  </div>
                )}
                {slotConflict && Object.keys(groupedConflicts).length > 0 && (
                  <div className="text-sm text-red-600 font-semibold text-center mt-2">
                    The following slots are already booked:<br/>
                    {Object.entries(groupedConflicts).map(([slot, dates]) => (
                      <span key={slot}>
                        {slot} on: {dates.map(d => new Date(d).toLocaleDateString()).join(", ")}<br/>
                      </span>
                    ))}
                    Please choose different dates or times.
                  </div>
                )}
                <div>
                  <label className="block font-medium mb-1 text-black">Purpose</label>
                  <input
                    type="text"
                    name="purpose"
                    value={form.purpose}
                    onChange={handleChange}
                    onPaste={handlePaste}
                    className="w-full px-3 py-2 bg-gray-100 text-black outline-none border border-gray-200 focus:border-[#7d92a7] focus:shadow-md transition-all duration-150 rounded-xl"
                    maxLength={50}
                    autoComplete="off"
                    required
                    placeholder="Enter purpose"
                  />
                  {errors.purpose && <p className="text-red-500 text-xs mt-1">{errors.purpose}</p>}
                </div>
                <div>
                  <label className="block font-medium mb-1 text-black">Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    onPaste={handlePaste}
                    className="w-full px-3 py-2 bg-gray-100 text-black outline-none border border-gray-200 focus:border-[#7d92a7] focus:shadow-md transition-all duration-150 rounded-xl"
                    maxLength={200}
                    rows={4}
                    autoComplete="off"
                    placeholder="Enter description"
                  />
                  {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
                </div>
                <div>
                  <label className="block font-medium mb-1 text-black">Your Email</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-100 text-black outline-none border border-gray-200 focus:border-[#7d92a7] focus:shadow-md transition-all duration-150 rounded-xl"
                    autoComplete="off"
                    required
                    placeholder="Enter your email"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
                <div className="flex justify-end items-end mt-4 gap-3">
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="bg-gradient-to-r from-gray-400 to-gray-600 hover:from-red-400 hover:to-red-600 text-white font-semibold py-2 px-6 rounded transition-colors shadow-md flex items-center justify-center"
                    style={{ minWidth: 120 }}
                  >
                    Clear Form
                  </button>
                  <button
                    type="submit"
                    className={`bg-gradient-to-r from-[#7d92a7] to-[#586364] hover:from-green-500 hover:to-green-800 text-white font-semibold py-2  px-8 rounded transition-colors shadow-md flex items-center justify-center`}
                    style={{ minWidth: 160 }}
                    disabled={slotConflict || loading}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                        Booking...
                      </>
                    ) : (
                      "Book Slot"
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg border border-green-200 p-6 mt-8">
                <div className="flex flex-col items-center mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 text-2xl">✔️</span>
                    <h2 className="text-xl font-bold text-green-700">Slot Booking Successful!</h2>
                  </div>
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold shadow mb-2">Booking No: <span className="font-mono">{getBookingNumber(ticket.startDate, ticket.startTime, ticket.endTime)}</span></span>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="py-2 flex justify-between">
                    <span className="font-semibold text-gray-500">Project:</span>
                    <span className="text-gray-900">{ticket.projectName}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="font-semibold text-gray-500">Department:</span>
                    <span className="text-gray-900">{ticket.departmentName}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="font-semibold text-gray-500">Start Date:</span>
                    <span className="text-gray-900">{ticket.startDate}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="font-semibold text-gray-500">End Date:</span>
                    <span className="text-gray-900">{ticket.endDate}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="font-semibold text-gray-500">Time:</span>
                    <span className="text-gray-900">{ticket.startTime && ticket.endTime ? `${ticket.startTime} - ${ticket.endTime}` : "-"}</span>
                  </div>
                  {ticket.startTime && ticket.endTime && (
                    <div className="py-2 flex justify-between">
                      <span className="font-semibold text-gray-500">Total Duration:</span>
                      <span className="text-gray-900" dangerouslySetInnerHTML={{__html: formatSlotDuration(ticket.startTime, ticket.endTime)}} />
                    </div>
                  )}
                  <div className="py-2 flex justify-between">
                    <span className="font-semibold text-gray-500">Purpose:</span>
                    <span className="text-gray-900">{ticket.purpose}</span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="font-semibold text-gray-500">Description:</span>
                    <span
                      className="text-gray-900"
                      style={{ wordBreak: "break-word", whiteSpace: "pre-line" }}
                    >
                      {ticket.description}
                    </span>
                  </div>
                  <div className="py-2 flex justify-between">
                    <span className="font-semibold text-gray-500">Email:</span>
                    <span className="text-gray-900">{ticket.email}</span>
                  </div>
                </div>
                <div className="flex flex-row gap-4 justify-center w-full mt-6">
                  <button
                    onClick={() => handleSaveTicket(true)}
                    className="bg-gradient-to-r from-[#7d92a7] to-[#586364] hover:from-gray-900 hover:to-gray-700 text-white font-semibold py-2 px-4 rounded transition-colors mt-2"
                  >
                    Download as PDF
                  </button>
                  <button
                    onClick={handleBackToForm}
                    className="bg-gradient-to-r from-[#7d92a7] to-[#586364] hover:from-gray-900 hover:to-gray-700 text-white font-semibold py-2 px-4 rounded transition-colors mt-2"
                    type="button"
                  >
                    Back
                  </button>
                </div>
                {saved && <div className="mt-2 text-green-600 font-semibold text-center">Ticket saved to your device!</div>}
              </div>
            )}
          </div>
          {/* Booked slots modal */}
          {showBookings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full relative">
                <button
                  className="absolute top-2 right-2 text-gray-500 hover:text-black"
                  onClick={() => setShowBookings(false)}
                  type="button"
                >
                  ✕
                </button>
                <h3 className="text-lg font-bold mb-4 text-[#4499a8]">Booked Slots (Last 1 Month)</h3>
                {bookings.length === 0 ? (
                  <div className="text-gray-500">No bookings found.</div>
                ) : (
                  <ul className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                    {bookings.map((b, i) => (
                      <li key={i} className="border rounded p-3 bg-gray-50 relative">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs text-black">Booked: {b.createdAt ? new Date(b.createdAt).toLocaleString() : ''}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gradient-to-r from-[#7d92a7] to-[#586364] text-white ml-2" style={{fontSize: '11px'}}>Bk No: {getBookingNumber(b.startDate, b.startTime, b.endTime)}</span>
                        </div>
                        <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">Project Name:</span><span className="ml-2">{b.projectName}</span></div>
                        <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">Dept. Name:</span><span className="ml-2">{b.departmentName}</span></div>
                        <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">Start Date:</span><span className="ml-2">{b.startDate}</span></div>
                        <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">End Date:</span><span className="ml-2">{b.endDate}</span></div>
                        {b.startTime && b.endTime ? (
                          <>
                            <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">Time:</span><span className="ml-2">{`${b.startTime} - ${b.endTime}`}</span></div>
                            <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">Total Duration:</span><span className="ml-2" dangerouslySetInnerHTML={{__html: formatSlotDuration(b.startTime, b.endTime)}} /></div>
                          </>
                        ) : (
                          <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">Time:</span><span className="ml-2">-</span></div>
                        )}
                        <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">Purpose:</span><span className="ml-2">{b.purpose}</span></div>
                        <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">Description:</span><span
                          className="text-gray-900"
                          style={{ wordBreak: "break-word", whiteSpace: "pre-line" }}
                        >
                          {b.description}
                        </span></div>
                        <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">Email:</span><span className="ml-2">{b.email}</span></div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
