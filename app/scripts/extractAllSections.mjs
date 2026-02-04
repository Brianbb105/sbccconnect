import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = path.resolve(process.cwd(), 'app/data/202650');
if (!fs.existsSync(OUTPUT_DIR)){
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  const ALL_CLASSES_URL = 'https://banner.sbcc.edu/ords/ssb/pw_pub_sched.p_listthislist?TERM=202650&TERM_DESC=Spring+2026&sel_subj=dummy&sel_day=dummy&sel_schd=dummy&sel_camp=dummy&sel_ism=dummy&sel_sess=dummy&sel_instr=dummy&sel_ptrm=dummy&level=CR&sel_attr=dummy&sel_subj=%25&sel_crse=&sel_crn=&sel_title=&sel_ptrm=%25&sel_ism=%25&sel_instr=%25&sel_attr=%25&begin_hh=5&begin_mi=0&begin_ap=a&end_hh=11&end_mi=0&end_ap=p&aa=N&bb=N&sel_late_start=N&dd=N&ee=N&gg=N';

  console.log('🔗 正在访问 SBCC Banner...');
  await page.goto(ALL_CLASSES_URL, { waitUntil: 'networkidle2', timeout: 60000 });

  console.log('✅ 页面加载完成，开始智能解析...');

  const sections = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tr'));
    const data = [];
    let currentCourseTitle = 'UNKNOWN COURSE';

    rows.forEach((row) => {
      const text = row.innerText.trim();
      const cells = Array.from(row.querySelectorAll('td'));

      // --- 1. 抓取标题 ---
      // 只要包含 "-" 且开头像课程代号 (CS 105)
      if (text.match(/^[A-Z]{2,4}\s+\d{3}.*-/)) {
        currentCourseTitle = text;
        return;
      }

      // 必须有足够多的列才处理
      if (cells.length < 10) return;

      const getText = (i) => cells[i] ? cells[i].innerText.trim() : '';

      // --- 2. 核心锚点：CRN (永远在 Index 2) ---
      const crn = getText(2);
      if (!crn || !/^\d{5}$/.test(crn)) return; // 不是 CRN 就跳过

      // --- 3. 倒序定位法 (The Elastic Logic) ---
      // 我们寻找包含日期的那一列作为"右锚点" (Right Anchor)
      // 格式通常是 "MM/DD-MM/DD" (例如 01/13-05/17)
      let dateIndex = -1;

      // 从后往前扫，找日期列
      for (let i = cells.length - 1; i > 5; i--) {
        if (getText(i).match(/\d{2}\/\d{2}-\d{2}\/\d{2}/)) {
          dateIndex = i;
          break;
        }
      }

      // 如果找不到日期，就默认它是倒数第3列 (根据你的截图经验)
      if (dateIndex === -1) dateIndex = cells.length - 3;

      // --- 4. 根据锚点推算其他列 ---
      // Date 的前一列通常是 Instructor
      const instructorIndex = dateIndex - 1;

      // Instructor 的前一列是 Waitlist Remaining (我们不存)
      // 再前是 Waitlist Act
      // 再前是 Waitlist Cap
      // 再前是 Remaining
      // 再前是 Actual (已选人数) -> dateIndex - 6
      // 再前是 Capacity (课容量) -> dateIndex - 7
      // 再前是 Location (地点)    -> dateIndex - 8

      // 注意：这个 -6, -7, -8 是基于标准 Banner 结构的推测。
      // 根据你的截图 debug: 'ONLINE'(6), '30'(7), '29'(8), '5'(9), '0'(WL), 'Eva'(11), 'Date'(12)
      // Date(12) - Instructor(11) = 1 (正确)
      // Date(12) - Act(8) = 4
      // Date(12) - Cap(7) = 5
      // Date(12) - Loc(6) = 6

      // 所以修正偏移量：
      const actIndex = dateIndex - 4;
      const capIndex = dateIndex - 5;
      const locationIndex = dateIndex - 6;

      // --- 5. 提取 Time 和 Days (处理动态列) ---
      // Time 从 Index 5 开始，一直到 LocationIndex 之前
      // 比如：Index 5 是 Time, Index 6,7,8,9 是 M T W R
      let timeAndDays = [];
      for (let k = 5; k < locationIndex; k++) {
        const content = getText(k);
        if (content) timeAndDays.push(content);
      }
      const finalTime = timeAndDays.join(' '); // "10:00-11:15 M W"

      // --- 6. 提取教授 (不再依赖逗号) ---
      let instructor = getText(instructorIndex);
      if (!instructor || instructor.length < 2) instructor = "TBA";

      // --- 7. 解析标题 ---
      let courseCode = "UNKNOWN";
      let courseName = "UNKNOWN";
      if (currentCourseTitle !== 'UNKNOWN COURSE') {
        const parts = currentCourseTitle.split('-');
        if (parts.length >= 2) {
          courseCode = parts[0].trim();
          courseName = parts[1].replace(/\(.*\)/, '').replace(/\d+(\.\d+)?\s+Units.*/i, '').trim();
        }
      }

      data.push({
        crn: crn,
        status: getText(0),
        course: courseCode,
        title: courseName,
        units: getText(3),
        type: getText(4),
        time: finalTime, // 包含了时间+星期
        location: getText(locationIndex),
        cap: getText(capIndex),
        act: getText(actIndex),
        instructor: instructor
      });
    });
    return data;
  });

  console.log(`🎉 抓取成功！共找到 ${sections.length} 个 Sections。`);

  if (sections.length > 0) {
    console.log("--- 预览 (Check CS 105) ---");
    // 找一个 CS 的课打印出来看看
    const csClass = sections.find(s => s.course.includes('CS')) || sections[0];
    console.log(JSON.stringify(csClass, null, 2));
  }

  const filePath = path.join(OUTPUT_DIR, 'sections.json');
  fs.writeFileSync(filePath, JSON.stringify(sections, null, 2));
  console.log(`💾 JSON 已保存`);

  await browser.close();
})();