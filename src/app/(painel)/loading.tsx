/** Aparece na hora ao trocar de tela, enquanto o servidor busca os dados. */
export default function Carregando() {
  return (
    <div aria-busy="true" aria-label="Carregando">
      <div className="skel" style={{ width: 180, height: 30, marginBottom: 20 }} />
      <div className="stats">
        <div className="card"><div className="skel" style={{ width: 120, height: 14, marginBottom: 12 }} /><div className="skel" style={{ width: 80, height: 28 }} /></div>
        <div className="card"><div className="skel" style={{ width: 160, height: 14, marginBottom: 12 }} /><div className="skel" style={{ width: 110, height: 28 }} /></div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="skel" style={{ height: 18, margin: "14px 0", width: `${92 - i * 7}%` }} />
        ))}
      </div>
    </div>
  );
}
