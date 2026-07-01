// Vercel Serverless Function (Node.js runtime)
// お問い合わせフォームの実送信。Xserver の SMTP を nodemailer で使用。
// 秘密情報（SMTP パスワード等）は環境変数からのみ読み込む。ハードコード禁止。
import nodemailer from 'nodemailer';

const LIMITS = { name: 100, email: 200, subject: 200, message: 4000 };

// 複数行フィールド（message 用）：C0/C1 制御文字を除去（\t \n \r は残す）→ 前後空白除去
function sanitize(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
    .trim();
}

// 単一行フィールド（name/email/subject 用）：改行・タブも含め全制御文字を除去
// → ヘッダ（Subject/Reply-To）へ流れる値の CRLF ヘッダインジェクションを防止
function sanitizeLine(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
    .trim();
}

function isValidEmail(email) {
  // 簡易形式チェック（厳密な RFC 準拠までは求めない）
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  // POST 以外は 405
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  // body の取り出し（Vercel は JSON を自動パースするが、文字列で来た場合も考慮）
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      return res.status(400).json({ ok: false, message: '不正なリクエストです。' });
    }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ ok: false, message: '不正なリクエストです。' });
  }

  // ハニーポット：埋まっていたらボットとみなし、成功を装って送信しない
  const honeypot = sanitizeLine(body.company_hp);
  if (honeypot) {
    return res.status(200).json({ ok: true });
  }

  const name = sanitizeLine(body.name);
  const email = sanitizeLine(body.email);
  const subject = sanitizeLine(body.subject);
  const message = sanitize(body.message);

  // 入力検証：必須（name・email・message）
  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, message: '必須項目が未入力です。' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, message: 'メールアドレスの形式が正しくありません。' });
  }
  if (
    name.length > LIMITS.name ||
    email.length > LIMITS.email ||
    subject.length > LIMITS.subject ||
    message.length > LIMITS.message
  ) {
    return res.status(400).json({ ok: false, message: '入力文字数が上限を超えています。' });
  }

  // 環境変数（秘密情報は env のみ）
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const to = process.env.CONTACT_TO || 'support@nueva.co.jp';

  // env 未設定時はクラッシュせず 500（パスワードは絶対にログへ出さない）
  if (!host || !user || !pass) {
    console.error('[contact] SMTP env 未設定のため送信できません（SMTP_HOST/SMTP_USER/SMTP_PASSWORD のいずれか欠落）');
    return res.status(500).json({ ok: false, message: '現在お問い合わせを受け付けできません。時間をおいてお試しください。' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // 465 は SSL/TLS
      auth: { user, pass },
    });

    const mailSubject = subject
      ? `【お問い合わせ】${subject}`
      : '【お問い合わせ】ヌエヴァHP フォームより';

    const text = [
      'ヌエヴァホールディングHP のお問い合わせフォームより送信されました。',
      '',
      `お名前: ${name}`,
      `メールアドレス: ${email}`,
      `件名: ${subject || '(未入力)'}`,
      '',
      'メッセージ:',
      message,
    ].join('\n');

    await transporter.sendMail({
      from: `"ヌエヴァHP お問い合わせ" <${user}>`,
      to,
      replyTo: email,
      subject: mailSubject,
      text,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    // 詳細はログのみ、レスポンスは汎用メッセージ（秘密情報は出さない）
    console.error('[contact] メール送信に失敗しました:', err && err.message ? err.message : err);
    return res.status(500).json({ ok: false, message: '送信に失敗しました。時間をおいて再度お試しください。' });
  }
}
