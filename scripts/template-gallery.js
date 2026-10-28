#!/usr/bin/env node
/**
 * Render one still per scene template (with sample data) so the infographic look can be checked
 * without spending any narration quota:  node scripts/template-gallery.js [outDir] [templateName ...]
 */
const fs = require('fs').promises;
const path = require('path');
const renderer = require('../utils/remotion-renderer');

const ROOT = path.join(__dirname, '..');

const SAMPLES = {
  big_question: { headline: 'Bao nhiêu tiền?', subtitle: 'Để tự do tài chính', data: { icon: 'piggy', text: 'BẠN ĐÃ TỰ HỎI?', caption: 'CẦN BAO NHIÊU TIỀN?' } },
  big_number: { headline: 'Con số cần có', subtitle: 'Với chi tiêu 15 triệu/tháng', data: { icon: 'coins', value: '4,5 tỷ', caption: 'đồng để tự do tài chính', note: '= 180 TRIỆU × 25' } },
  formula: { headline: 'Công thức', subtitle: 'Chỉ một phép nhân', data: { items: [{ text: 'Chi tiêu 1 năm', sub: '15 triệu × 12 tháng', icon: 'wallet' }, { text: '25', sub: 'hệ số quy tắc 4%', icon: 'calendar' }], ops: ['×', '='], result: { text: '4,5 TỶ ĐỒNG', sub: 'số tiền tự do tài chính' } } },
  steps: { headline: 'Ba bước', subtitle: 'Tính con số của bạn', data: { steps: [{ text: 'Ghi lại chi tiêu mỗi tháng', sub: 'dùng sao kê ngân hàng' }, { text: 'Nhân với mười hai tháng' }, { text: 'Nhân tiếp với hai mươi lăm', sub: 'ra số tiền cần có' }] } },
  timeline: { headline: 'Lịch sử ngắn', subtitle: 'Từ cổ đại đến nay', data: { items: [{ label: '1969', text: 'Con người đặt chân lên Mặt Trăng' }, { label: '1981', text: 'Tàu con thoi đầu tiên cất cánh' }, { label: '2012', text: 'Tàu thăm dò chạm đất sao Hỏa' }] } },
  bar_chart: { headline: 'Để dành càng nhiều', subtitle: 'Càng sớm tự do', data: { title: 'TỶ LỆ TIẾT KIỆM → SỐ NĂM', items: [{ label: '10%', value: 51, text: '51 năm' }, { label: '25%', value: 32, text: '32 năm' }, { label: '50%', value: 17, text: '17 năm' }, { label: '70%', value: 9, text: '9 năm' }], note: 'giả sử lãi thực 5% mỗi năm' } },
  compare: { headline: 'Hai cách nghĩ', subtitle: 'Tiết kiệm hay kiếm thêm', data: { left: { title: 'GIẢM CHI', icon: 'wallet', points: ['Cần ít tiền hơn', 'Có hiệu quả ngay'] }, right: { title: 'KIẾM THÊM', icon: 'chart', points: ['Để dành nhanh hơn', 'Cần thời gian'] } } },
  list_points: { headline: 'Ba thói quen', subtitle: 'Của người tiết kiệm', data: { items: [{ text: 'Ghi lại mọi khoản chi', icon: 'book' }, { text: 'Tiết kiệm trước, tiêu sau', icon: 'piggy' }, { text: 'Đầu tư đều đặn mỗi tháng', icon: 'chart' }] } },
  percent: { headline: 'Phần nổi', subtitle: 'Chỉ chín phần trăm', data: { percent: 9, label: 'Trên mặt nước', restLabel: 'Dưới nước', caption: 'phần nổi' } },
  icon_scene: { headline: 'Trái Đất', subtitle: 'Hành tinh của chúng ta', data: { icon: 'globe', callouts: ['71% là nước', 'Xoay mỗi 24 giờ', 'Cách Mặt Trời 150 triệu km'] } },
  note: { headline: 'Lưu ý nhỏ', subtitle: 'Trước khi áp dụng', data: { icon: 'warning', title: 'CHỈ ĐỂ THAM KHẢO', items: ['Lạm phát có thể thay đổi', 'Lãi suất mỗi nơi mỗi khác', 'Không phải lời khuyên đầu tư'] } },
  outro_generic: { headline: 'Hẹn gặp lại!', subtitle: 'Yang Tò Mò', labels: ['ĐĂNG KÝ KÊNH', 'THẢ TIM', 'BÌNH LUẬN'] }
};

async function main() {
  const args = process.argv.slice(2);
  const outDir = path.resolve(args[0] || path.join(ROOT, 'temp', 'template-gallery'));
  const only = args.slice(1);
  const names = Object.keys(SAMPLES).filter(name => !only.length || only.includes(name));
  await fs.mkdir(outDir, { recursive: true });
  const scenes = names.map((name, i) => ({
    template: name, headline: SAMPLES[name].headline, subtitle: SAMPLES[name].subtitle,
    labels: SAMPLES[name].labels || null, data: SAMPLES[name].data || {}, mood: 'happy', start: i * 6, duration: 6
  }));
  const propsPath = path.join(outDir, 'props.json');
  await fs.writeFile(propsPath, JSON.stringify({ durationInSeconds: scenes.length * 6, audioFile: null, mascotFile: null, mouthEnvelope: [], phrases: [], scenes }));
  for (let i = 0; i < names.length; i++) {
    const frame = Math.round((i * 6 + 4.6) * 30);
    await renderer.renderComposition({ composition: 'InfoVideo', outputPath: path.join(outDir, `${String(i + 1).padStart(2, '0')}-${names[i]}.png`), propsPath, publicDir: path.join(ROOT, 'remotion', 'public'), frame });
    console.log(`rendered ${names[i]}`);
  }
}

main().catch(error => { console.error(error.message); process.exit(1); });
