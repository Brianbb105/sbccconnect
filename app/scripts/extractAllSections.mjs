import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.resolve(process.cwd(), 'app/data/202650');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const ALL_CLASSES_URL = 'https://banner.sbcc.edu/ords/ssb/pw_pub_sched.p_listthislist?TERM=202650&TERM_DESC=Spring+2026&sel_subj=dummy&sel_day=dummy&sel_schd=dummy&sel_camp=dummy&sel_ism=dummy&sel_sess=dummy&sel_instr=dummy&sel_ptrm=dummy&level=CR&sel_attr=dummy&sel_subj=%25&sel_crse=&sel_crn=&sel_title=&sel_ptrm=%25&sel_ism=%25&sel_instr=%25&sel_attr=%25&begin_hh=5&begin_mi=0&begin_ap=a&end_hh=11&end_mi=0&end_ap=p&aa=N&bb=N&sel_late_start=N&dd=N&ee=N&gg=N';

  console.log('🔗 Accessing SBCC Banner...');
  await page.goto(ALL_CLASSES_URL, { waitUntil: 'networkidle2', timeout: 60000 });

  try {
    await page.waitForSelector('tr', { timeout: 10000 });
  } catch {
    console.log("⚠️ Warning: Timeout waiting for 'tr'. Page might be empty.");
  }

  console.log('✅ Page loaded. Starting Extraction with "Missing Date" Fix...');

  const { data: classesData } = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr'));

    const resultMap = {};
    let currentCourseCode = "UNKNOWN";
    let currentCourseTitle = "UNKNOWN";
    let currentIGETCAreas = [];
    let currentCourseDescription = "";
    let currentPrerequisitesText = "";
    let currentPrerequisites = [];
    let lastSeenCrn = null;

    const DATE_RE = /\b\d{2}\/\d{2}-\d{2}\/\d{2}\b/;
    const TIME_RE = /\b\d{1,2}:\d{2}\s*(?:am|pm)\s*-\s*\d{1,2}:\d{2}\s*(?:am|pm)\b/i;
    const HOURS_RE = /[\d.]+\s*hours\/week/i;
    const ONLINE_RE = /\b(ONLINE|ZOOM|WEB|REMOTE)\b/i;
    const CRN_RE = /^\d{5}$/;
    const NUMERIC_RE = /^\d+(?:\.\d+)?$/;
    const DAY_TOKEN_RE = /^[MTWRFSU]$/;
    const HEADER_TOKENS = new Set([
      "TYPE", "DAYS", "TIME", "LOCATION", "INSTRUCTOR", "DATE", "WEEKS",
      "STATUS", "CRN", "CMP", "SEC"
    ]);

    const uniq = (arr) => [...new Set(arr)];
    const getClean = (s) => (s || "").trim();
    const normalizeSpacing = (s) => getClean(s).replace(/\s+/g, " ");
    const normalizeStatus = (s) => normalizeSpacing(s)
        .replace(/(OPEN|CLOSED|Waitlisted|STANDBY)(With Add Code)/i, '$1 $2');
    const CAMPUS_MAP_SUFFIX = "Santa Barbara City College Santa Barbara CA";

    const splitPrerequisites = (text) => {
      const normalized = normalizeSpacing(text);
      if (!normalized) return [];
      const parts = normalized
          .split(/(?:\s*;\s*|\s*\|\s*|\.\s+(?=(?:[A-Z]{2,6}\s*\d{1,3}[A-Z]?|Prereq|Prerequisite|Corequisite|Advisory)))/i)
          .map((v) => normalizeSpacing(v))
          .filter(Boolean);
      return uniq(parts);
    };

    const isMeaningfulLocation = (location) => {
      const loc = normalizeSpacing(location).toUpperCase();
      if (!loc || loc === "TBA") return false;
      if (HEADER_TOKENS.has(loc)) return false;
      return true;
    };

    const buildGoogleMapsUrl = (location) => {
      const normalizedLocation = normalizeSpacing(location);
      const upper = normalizedLocation.toUpperCase();
      if (!normalizedLocation || upper === "TBA") return "";
      if (ONLINE_RE.test(upper)) return "";
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${normalizedLocation} ${CAMPUS_MAP_SUFFIX}`)}`;
    };

    const isOnlineMeeting = (meeting) => {
      const loc = normalizeSpacing(meeting.location).toUpperCase();
      const time = normalizeSpacing(meeting.time).toLowerCase();
      return ONLINE_RE.test(loc) || time.includes("hours/week");
    };

    const isInPersonMeeting = (meeting) => {
      const loc = normalizeSpacing(meeting.location).toUpperCase();
      if (!loc || loc === "TBA") return false;
      return !ONLINE_RE.test(loc);
    };

    const extractIgetcAreas = (text) => {
      const areas = [];
      const blocks = Array.from(text.matchAll(/IGETC\s*Area(?:s)?\s*([^.;|]+)/gi));

      blocks.forEach((match) => {
        const block = match[1] || "";
        const found = block.match(/\b[0-9][A-Z]?\b/g);
        if (found) areas.push(...found.map((v) => v.toUpperCase()));
      });

      if (!areas.length && /IGETC/i.test(text)) {
        const fallback = text.match(/\b([0-9][A-Z]?)\b/g);
        if (fallback) {
          areas.push(...fallback.map((v) => v.toUpperCase()));
        }
      }

      return uniq(areas);
    };

    const looksLikeColumnHeader = (cellTexts, rowText) => {
      const upper = cellTexts.map((v) => normalizeSpacing(v).toUpperCase());
      const joined = upper.join(" ");
      if (upper.includes("TYPE") && (upper.includes("LOCATION") || upper.includes("INSTRUCTOR") || upper.includes("DATE"))) {
        return true;
      }
      if (joined.includes("STATUS") && joined.includes("CRN") && joined.includes("TYPE")) {
        return true;
      }
      return /TYPE\s+DAYS|STATUS\s+CRN|CRN\s+CMP/i.test(rowText.toUpperCase());
    };

    const applyCourseMetadataToExistingSections = () => {
      const normalizedDescription = normalizeSpacing(currentCourseDescription);
      const normalizedPrereqText = normalizeSpacing(currentPrerequisitesText);
      const normalizedPrerequisites = splitPrerequisites(normalizedPrereqText);

      Object.values(resultMap).forEach((entry) => {
        if (entry.courseCode !== currentCourseCode) return;
        entry.courseDescription = normalizedDescription;
        entry.prerequisitesText = normalizedPrereqText;
        entry.prerequisites = normalizedPrerequisites;
      });
    };

    const updateCourseMetadataFromText = (text) => {
      const normalized = normalizeSpacing(text);
      if (!normalized) return false;
      if (/transfer information/i.test(normalized) || /end of report/i.test(normalized)) return false;

      let updated = false;

      const prereqMatch = normalized.match(
          /(?:prerequisite(?:s)?|pre-?req(?:uisite)?(?:s)?|corequisite(?:s)?|co-?req(?:uisite)?(?:s)?|advisory|recommended preparation)\s*:?\s*(.+)$/i
      );
      if (prereqMatch?.[1]) {
        const chunk = normalizeSpacing(prereqMatch[1]).replace(/^[:\-]\s*/, "");
        if (chunk) {
          currentPrerequisitesText = currentPrerequisitesText
              ? `${currentPrerequisitesText}; ${chunk}`
              : chunk;
          updated = true;
        }
      }

      const descriptionMatch = normalized.match(
          /(?:course description|catalog description|description)\s*:?\s*(.+)$/i
      );
      if (descriptionMatch?.[1]) {
        const chunk = normalizeSpacing(descriptionMatch[1]).replace(/^[:\-]\s*/, "");
        if (chunk) {
          currentCourseDescription = currentCourseDescription
              ? `${currentCourseDescription} ${chunk}`
              : chunk;
          updated = true;
        }
      }

      const looksLikeMeetingRow = CRN_RE.test(normalized) || TIME_RE.test(normalized) || DATE_RE.test(normalized);
      const looksLikeMetaHeader = /^(prerequisite(?:s)?|pre-?req(?:uisite)?(?:s)?|corequisite(?:s)?|co-?req(?:uisite)?(?:s)?|advisory|recommended preparation|course description|catalog description|description)\s*:?\s*$/i.test(normalized);

      if (!updated && !looksLikeMeetingRow && !looksLikeMetaHeader && !looksLikeColumnHeader([normalized], normalized)) {
        if (/(?:prerequisite(?:s)?|pre-?req(?:uisite)?(?:s)?|corequisite(?:s)?|co-?req(?:uisite)?(?:s)?|advisory|recommended preparation)/i.test(normalized)) {
          currentPrerequisitesText = currentPrerequisitesText
              ? `${currentPrerequisitesText}; ${normalized}`
              : normalized;
          updated = true;
        } else if (normalized.length > 45) {
          currentCourseDescription = currentCourseDescription
              ? `${currentCourseDescription} ${normalized}`
              : normalized;
          updated = true;
        }
      }

      if (!updated) return false;
      currentCourseDescription = normalizeSpacing(currentCourseDescription);
      currentPrerequisitesText = normalizeSpacing(currentPrerequisitesText);
      currentPrerequisites = splitPrerequisites(currentPrerequisitesText);
      applyCourseMetadataToExistingSections();
      return true;
    };

    const normalizeType = (rawType, rowText, combinedTime, fallbackType) => {
      const candidate = normalizeSpacing(rawType);
      const upper = candidate.toUpperCase();

      if (upper === "LEC" || upper === "LECTURE") return "Lec";
      if (upper === "LAB" || upper === "LABORATORY") return "Lab";

      if (!candidate || HEADER_TOKENS.has(upper) || /^[MTWRFSU]+$/.test(upper)) {
        if (/\bLAB\b|\bLABORATORY\b/i.test(rowText)) return "Lab";
        if (/\bLEC\b|\bLECTURE\b/i.test(rowText)) return "Lec";
        if (HOURS_RE.test(combinedTime) || HOURS_RE.test(rowText)) return "Lec";
        if (fallbackType === "Lab" || fallbackType === "Lec") return fallbackType;
        return "";
      }

      return candidate;
    };

    const buildDays = (combinedTime) => {
      const dayTokens = combinedTime.match(/\b[MTWRFSU]\b/g) || [];
      return uniq(dayTokens).join(" ");
    };

    const getDayTokensFromCells = (cellValues, startIndex, endIndexExclusive) => {
      if (startIndex < 0 || endIndexExclusive <= startIndex) return "";
      const dayTokens = [];
      for (let i = startIndex; i < endIndexExclusive && i < cellValues.length; i++) {
        const val = normalizeSpacing(cellValues[i]).toUpperCase();
        if (DAY_TOKEN_RE.test(val)) dayTokens.push(val);
      }
      return uniq(dayTokens).join(" ");
    };

    const findTimeIndex = (cellValues) => {
      for (let i = 0; i < cellValues.length; i++) {
        if (TIME_RE.test(cellValues[i]) || HOURS_RE.test(cellValues[i])) return i;
      }
      return -1;
    };

    const findDateIndex = (cellValues) => {
      for (let i = cellValues.length - 1; i >= 0; i--) {
        if (DATE_RE.test(cellValues[i])) return i;
      }
      return -1;
    };

    const findTypeIndex = (cellValues) => {
      for (let i = 0; i < cellValues.length; i++) {
        if (/^(lec|lab|lecture|laboratory)$/i.test(cellValues[i])) return i;
      }
      return -1;
    };

    const pickLocation = (cellValues, startIndex, endIndexExclusive) => {
      if (startIndex < 0 || endIndexExclusive <= startIndex) return "";
      for (let i = startIndex; i < endIndexExclusive && i < cellValues.length; i++) {
        const val = normalizeSpacing(cellValues[i]);
        const upper = val.toUpperCase();
        if (!val) continue;
        if (HEADER_TOKENS.has(upper)) continue;
        if (DATE_RE.test(val) || TIME_RE.test(val)) continue;
        if (NUMERIC_RE.test(val)) continue;
        if (DAY_TOKEN_RE.test(upper)) continue;
        return val;
      }
      return "";
    };

    const pickInstructor = (cellValues, startIndex, endIndexExclusive, locationValue = "") => {
      if (startIndex < 0 || endIndexExclusive <= startIndex) return "";
      for (let i = Math.min(endIndexExclusive - 1, cellValues.length - 1); i >= startIndex; i--) {
        const raw = normalizeSpacing(cellValues[i]);
        const val = raw.replace(/\(.*\)/, '').trim();
        const upper = val.toUpperCase();
        if (!val) continue;
        if (val === locationValue) continue;
        if (HEADER_TOKENS.has(upper)) continue;
        if (DATE_RE.test(val) || TIME_RE.test(val)) continue;
        if (NUMERIC_RE.test(val)) continue;
        if (DAY_TOKEN_RE.test(upper)) continue;
        return val;
      }
      return "";
    };

    const pickFirstTwoNumbers = (cellValues, startIndex, endIndexExclusive) => {
      const numbers = [];
      if (startIndex < 0 || endIndexExclusive <= startIndex) return numbers;
      for (let i = startIndex; i < endIndexExclusive && i < cellValues.length; i++) {
        const val = normalizeSpacing(cellValues[i]);
        if (NUMERIC_RE.test(val)) numbers.push(val);
      }
      return numbers.slice(0, 2);
    };

    const getLayout = ({ hasCrn, cellCount, typeIndex, timeIndex, dateIndex }) => {
      // Standard in-person full row
      if (hasCrn && cellCount >= 20 && timeIndex === 12 && dateIndex === 19) {
        return {
          dayStart: 5, dayEnd: 12,
          locationStart: 13, locationEnd: 14,
          instructorStart: 18, instructorEnd: 19,
          capacityIndex: 14, enrolledIndex: 15
        };
      }

      // Primary online / hours-week row
      if (hasCrn && cellCount >= 15 && timeIndex === 5 && dateIndex === 12) {
        return {
          dayStart: 6, dayEnd: 5,
          locationStart: 6, locationEnd: 7,
          instructorStart: 11, instructorEnd: 12,
          capacityIndex: 7, enrolledIndex: 8
        };
      }

      // Continuation meeting row (lab/extra lec)
      if (!hasCrn && cellCount >= 14 && typeIndex === 1 && timeIndex === 9 && dateIndex === 12) {
        return {
          dayStart: 2, dayEnd: 9,
          locationStart: 10, locationEnd: 11,
          instructorStart: 11, instructorEnd: 12,
          capacityIndex: -1, enrolledIndex: -1
        };
      }

      // Compact continuation row (online hours/week)
      if (!hasCrn && cellCount >= 7 && typeIndex === 1 && timeIndex === 2 && dateIndex === 5) {
        return {
          dayStart: 3, dayEnd: 2,
          locationStart: 3, locationEnd: 4,
          instructorStart: 4, instructorEnd: 5,
          capacityIndex: -1, enrolledIndex: -1
        };
      }

      // Fallback: infer ranges from type/time/date anchors.
      const inferredDayStart = typeIndex >= 0 ? typeIndex + 1 : 0;
      const inferredDayEnd = timeIndex > inferredDayStart ? timeIndex : inferredDayStart;
      const inferredLocationStart = timeIndex >= 0 ? timeIndex + 1 : inferredDayEnd;
      const inferredLocationEnd = dateIndex > inferredLocationStart ? dateIndex : cellCount;
      return {
        dayStart: inferredDayStart,
        dayEnd: inferredDayEnd,
        locationStart: inferredLocationStart,
        locationEnd: inferredLocationEnd,
        instructorStart: inferredLocationStart,
        instructorEnd: inferredLocationEnd,
        capacityIndex: -1,
        enrolledIndex: -1
      };
    };

    // Persist the column layout across rows for the same class block
    let activeDateIndex = -1;

    rows.forEach((row) => {
      let text = row.innerText.trim();
      const cells = Array.from(row.querySelectorAll('td'));
      const cellTexts = cells.map((cell) => cell.innerText.trim());

      // --- 1. HEADER DETECTION ---
      const headerMatch = text.match(/^([A-Z]{2,6})\s+([A-Z0-9]{3,6})/);
      if (headerMatch && cells.length < 8 && !/^\d{5}/.test(text)) {
        currentIGETCAreas = [];
        currentCourseDescription = "";
        currentPrerequisitesText = "";
        currentPrerequisites = [];
        lastSeenCrn = null;
        activeDateIndex = -1;

        const rawCode = headerMatch[0];
        let titlePart = "";
        if (text.includes(' - ')) {
          const parts = text.split(' - ');
          titlePart = parts[0].length < 20 && parts[1] ? parts[1] : text.replace(rawCode, "");
        } else {
          titlePart = text.replace(rawCode, "");
        }

        currentCourseCode = rawCode.trim();
        currentCourseTitle = titlePart
            .replace(/\(.*\)/g, '')
            .replace(/[\d.]+\s+Units.*/i, '')
            .trim();
        return;
      }

      // --- 2. IGETC EXTRACTION ---
      if (text.includes("Transfer Information") || text.includes("IGETC")) {
        const areas = extractIgetcAreas(text);
        if (areas.length) {
          currentIGETCAreas = uniq([...currentIGETCAreas, ...areas]);
        }
        return;
      }

      // --- 3. COURSE META EXTRACTION (Description + Prerequisites) ---
      if (updateCourseMetadataFromText(text)) return;

      // --- 3. DATA ROW VALIDATION ---
      if (!text || cells.length < 4) return;
      if (looksLikeColumnHeader(cellTexts, text)) return;

      const getText = (i) => cells[i] ? cells[i].innerText.trim() : '';
      const cellValues = cellTexts.map((v) => normalizeSpacing(v));
      const rowJoined = cellValues.join(" ");

      if (/end of report/i.test(rowJoined)) return;
      if (cellValues.every((v) => !v || /^_+$/.test(v))) return;

      // --- 4. Row Anchors ---
      let dateIndex = findDateIndex(cellValues);
      const timeIndex = findTimeIndex(cellValues);
      const typeIndex = findTypeIndex(cellValues);

      let crn = null;
      for (let c = 0; c < cellValues.length; c++) {
        if (CRN_RE.test(cellValues[c])) {
          crn = cellValues[c];
          break;
        }
      }
      const hasCrn = !!crn;

      // C. Fallback Logic
      const hasMeetingSignal = timeIndex !== -1 || typeIndex !== -1 || /\b(lec|lab|lecture|laboratory)\b/i.test(text);

      if (dateIndex !== -1) {
        activeDateIndex = dateIndex;
      } else if (lastSeenCrn && activeDateIndex !== -1) {
        dateIndex = Math.min(activeDateIndex, cellValues.length - 1);
      } else if (!hasMeetingSignal && !hasCrn) {
        return;
      }

      const safeDateIndex = dateIndex >= 0 ? Math.min(dateIndex, cellValues.length - 1) : -1;
      const rowLayout = getLayout({
        hasCrn,
        cellCount: cellValues.length,
        typeIndex,
        timeIndex,
        dateIndex: safeDateIndex
      });

      // --- DATA EXTRACTION ---
      const status = normalizeStatus(getText(0) || "OPEN");

      const previousType = lastSeenCrn && resultMap[lastSeenCrn]?.meetings?.length
          ? resultMap[lastSeenCrn].meetings[resultMap[lastSeenCrn].meetings.length - 1].type
          : "";

      let rawType = typeIndex >= 0 ? cellValues[typeIndex] : "";
      if (!rawType && /\bLAB\b|\bLABORATORY\b/i.test(text)) rawType = "Lab";
      if (!rawType && /\bLEC\b|\bLECTURE\b/i.test(text)) rawType = "Lec";

      const timeCellValue = timeIndex >= 0 ? cellValues[timeIndex] : "";
      const type = normalizeType(rawType, text, timeCellValue, previousType);
      const inferredType = type || (hasMeetingSignal ? "Lec" : "");

      let cleanDays = getDayTokensFromCells(cellValues, rowLayout.dayStart, rowLayout.dayEnd);
      if (!cleanDays && timeCellValue) {
        cleanDays = buildDays(timeCellValue);
      }

      // Clean Time
      let timeStr = "TBA";
      const stdTimeMatch = timeCellValue.match(TIME_RE) || text.match(TIME_RE);
      if (stdTimeMatch) {
        timeStr = normalizeSpacing(stdTimeMatch[0]);
      } else if (HOURS_RE.test(timeCellValue) || HOURS_RE.test(text)) {
        const hoursMatch = timeCellValue.match(HOURS_RE) || text.match(HOURS_RE);
        if (hoursMatch) timeStr = hoursMatch[0];
      }

      const locationRangeEnd = safeDateIndex > rowLayout.locationEnd ? safeDateIndex : rowLayout.locationEnd;
      const location = normalizeSpacing(
          pickLocation(cellValues, rowLayout.locationStart, locationRangeEnd)
          || cellValues.find((val) => ONLINE_RE.test(val))
          || ""
      );

      const instructor = normalizeSpacing(
          pickInstructor(cellValues, rowLayout.instructorStart, rowLayout.instructorEnd, location)
          || pickInstructor(cellValues, rowLayout.locationStart, safeDateIndex >= 0 ? safeDateIndex : cellValues.length, location)
      );

      const fallbackDate = lastSeenCrn && resultMap[lastSeenCrn]?.meetings?.length
          ? resultMap[lastSeenCrn].meetings[resultMap[lastSeenCrn].meetings.length - 1].dateRange
          : "";

      const meetingObj = {
        type: inferredType || "Lec",
        days: cleanDays,
        time: timeStr,
        location: location,
        googleMapsUrl: buildGoogleMapsUrl(location),
        instructor: instructor || "TBA",
        dateRange: safeDateIndex >= 0 ? cellValues[safeDateIndex] : fallbackDate
      };

      // --- VALID ROW CHECK ---
      const hasType = inferredType === "Lec" || inferredType === "Lab";
      const hasTime = meetingObj.time && meetingObj.time !== "TBA";
      const hasLocation = isMeaningfulLocation(meetingObj.location);
      const hasDays = !!meetingObj.days;
      const hasContent = hasTime || hasLocation || hasDays || inferredType === "Lab" || (hasCrn && hasType);

      if (hasCrn) {
        const countWindowStart = rowLayout.locationStart >= 0 ? rowLayout.locationStart + 1 : 0;
        const countWindowEnd = safeDateIndex >= 0 ? safeDateIndex : cellValues.length;
        const fallbackCounts = pickFirstTwoNumbers(cellValues, countWindowStart, countWindowEnd);

        const rawCapacity = rowLayout.capacityIndex >= 0 ? normalizeSpacing(cellValues[rowLayout.capacityIndex] || "") : "";
        const rawEnrolled = rowLayout.enrolledIndex >= 0 ? normalizeSpacing(cellValues[rowLayout.enrolledIndex] || "") : "";
        const capacity = rawCapacity || fallbackCounts[0] || "";
        const enrolled = rawEnrolled || fallbackCounts[1] || "";

        lastSeenCrn = crn;
        if (!resultMap[crn]) {
          resultMap[crn] = {
            crn: crn,
            status,
            courseCode: currentCourseCode,
            courseTitle: currentCourseTitle,
            igetc: currentIGETCAreas[0] || null,
            igetcAreas: [...currentIGETCAreas],
            courseDescription: currentCourseDescription,
            prerequisitesText: currentPrerequisitesText,
            prerequisites: [...currentPrerequisites],
            units: getText(3),
            capacity,
            enrolled,
            meetings: []
          };
        }

        if (hasContent) {
          resultMap[crn].meetings.push(meetingObj);
        }
      } else if (lastSeenCrn && hasContent) {
        resultMap[lastSeenCrn].meetings.push(meetingObj);
      }
    });

    // --- MODALITY CALCULATION ---
    const finalData = Object.values(resultMap).map(cls => {
      const dedupedMeetings = [];
      const seenMeetings = new Set();

      cls.meetings.forEach((meeting) => {
        const normalizedType = meeting.type === "Lab" ? "Lab" : "Lec";
        const normalizedMeeting = {
          ...meeting,
          type: normalizedType,
          days: normalizeSpacing(meeting.days),
          time: normalizeSpacing(meeting.time) || "TBA",
          location: normalizeSpacing(meeting.location),
          googleMapsUrl: buildGoogleMapsUrl(meeting.location),
          instructor: normalizeSpacing(meeting.instructor) || "TBA",
          dateRange: normalizeSpacing(meeting.dateRange)
        };

        const meaningful = normalizedMeeting.type === "Lab"
            || normalizedMeeting.time !== "TBA"
            || isMeaningfulLocation(normalizedMeeting.location)
            || !!normalizedMeeting.days;

        if (!meaningful) return;

        const key = [
          normalizedMeeting.type,
          normalizedMeeting.days,
          normalizedMeeting.time,
          normalizedMeeting.location,
          normalizedMeeting.instructor,
          normalizedMeeting.dateRange
        ].join("|");

        if (!seenMeetings.has(key)) {
          seenMeetings.add(key);
          dedupedMeetings.push(normalizedMeeting);
        }
      });

      if (!dedupedMeetings.length) {
        dedupedMeetings.push({
          type: "Lec",
          days: "",
          time: "TBA",
          location: "TBA",
          googleMapsUrl: "",
          instructor: "TBA",
          dateRange: ""
        });
      }

      const lecMeetings = dedupedMeetings.filter((m) => m.type === "Lec");
      const labMeetings = dedupedMeetings.filter((m) => m.type === "Lab");
      const hasHybridLecturePattern = lecMeetings.length >= 2;
      const hasLab = labMeetings.length > 0;
      const hasOnlineLab = labMeetings.some((m) => isOnlineMeeting(m));

      const hasOnline = dedupedMeetings.some((m) => isOnlineMeeting(m));
      const hasInPerson = dedupedMeetings.some((m) => isInPersonMeeting(m));

      let modality = "IP";
      if (hasHybridLecturePattern || (hasOnline && hasInPerson)) modality = "HY";
      else if (hasOnline) modality = "OL";
      else modality = "IP";

      const igetcAreas = uniq((cls.igetcAreas || []).filter(Boolean));
      const normalizedPrerequisites = uniq(
          (Array.isArray(cls.prerequisites) && cls.prerequisites.length
              ? cls.prerequisites
              : splitPrerequisites(cls.prerequisitesText || "")
          )
              .map((value) => normalizeSpacing(value))
              .filter(Boolean)
      );
      const normalizedPrerequisitesText = normalizeSpacing(
          cls.prerequisitesText || normalizedPrerequisites.join("; ")
      );
      const normalizedDescription = normalizeSpacing(cls.courseDescription || "");

      return {
        ...cls,
        igetc: cls.igetc || igetcAreas[0] || null,
        igetcAreas,
        courseDescription: normalizedDescription,
        prerequisitesText: normalizedPrerequisitesText,
        prerequisites: normalizedPrerequisites,
        meetings: dedupedMeetings,
        hasLab,
        hasOnlineLab,
        hasHybridLecturePattern,
        modality
      };
    });

    return { data: finalData };
  });

  console.log(`🎉 Scraping Complete. Found ${classesData.length} classes.`);

  const filePath = path.join(OUTPUT_DIR, 'sections.json');
  fs.writeFileSync(filePath, JSON.stringify(classesData, null, 2));
  console.log(`💾 JSON saved to ${filePath}`);

  await browser.close();
})();
