const fs = require('fs');
const js = fs.readFileSync('salvataggio.js', 'utf8');

function escapeHtml(text) { return text || ''; }

let v = {
  presenti: [],
  referenti: "Mario Rossi",
  delegaCSE: null, allegaMezzi: false, projectId: 'P1'
};

const htmlStr = `${(v.presenti && v.presenti.length > 0) ? `
    <h2>Presenti al Sopralluogo</h2>
    <table>
      ${v.presenti.map((p, i) => `<tr>...</tr>`).join('')}
    </table>` : `
    <!-- FLUSSO 2: REFERENTI TESTUALI (SPAZIO FIRMA MANUALE) -->
    ${v.referenti ? `
    <h2>Firme per Presa Visione (Presenti)</h2>
    <table>
      ${v.referenti.split(/[\n,;·]+/).map(r => r.trim()).filter(r => r).map(r => `
      <tr>
        <td style="padding:10pt 8pt;">${escapeHtml(r)}</td>
      </tr>
      `).join('')}
    </table>
    ` : ''}`}`;

console.log(htmlStr);
