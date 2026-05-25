
function formatBrazilPhone(raw) {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  if (digits.length < 10 || digits.length > 11) {
    return null;
  }
  return '55' + digits;
}

function testPhoneFormatting() {
  const cases = [
    { in: "5511999998888", out: "5511999998888" },
    { in: "11999998888", out: "5511999998888" },
    { in: "(11) 99999-8888", out: "5511999998888" },
    { in: "11 99999 8888", out: "5511999998888" },
    { in: "551188887777", out: "551188887777" },
    { in: "1188887777", out: "551188887777" },
    { in: "123", out: null },
  ];

  console.log("Testing Phone Formatting:");
  cases.forEach(c => {
    const res = formatBrazilPhone(c.in);
    const status = res === c.out ? "✅" : "❌";
    console.log(`${status} In: ${c.in} -> Expected: ${c.out}, Got: ${res}`);
  });
}

testPhoneFormatting();
