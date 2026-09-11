document.addEventListener("DOMContentLoaded", () => {
  const token = document.querySelector('meta[name="csrf-token"]')?.content;
  document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach(x => x.classList.toggle("active", x === button));
    document.querySelectorAll(".panel").forEach(x => x.classList.toggle("hidden", x.id !== button.dataset.tab));
  }));
  const applyFilters = () => { const q = (document.querySelector("#search")?.value || "").toLowerCase(); const f = document.querySelector("[data-filter].active")?.dataset.filter || "all"; document.querySelectorAll(".job").forEach(card => card.hidden = !card.dataset.search.includes(q) || (f !== "all" && card.dataset[f] !== "true")); };
  document.querySelector("#search")?.addEventListener("input", applyFilters);
  document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => { document.querySelectorAll("[data-filter]").forEach(x => x.classList.toggle("active", x === button)); applyFilters(); }));
  document.querySelectorAll(".queue-button").forEach(button => button.addEventListener("click", async () => { const queued = button.classList.contains("queued"); const response = await fetch("/api/hunter", {method:"POST", headers:{"Content-Type":"application/json", "X-CSRF-Token":token}, body:JSON.stringify({type:queued ? "remove" : "select", slug:button.dataset.slug})}); if(response.ok){button.classList.toggle("queued");button.textContent=queued ? "Add to queue" : "Queued ✓";} }));
  document.querySelectorAll("[data-hunter-action]").forEach(button => button.addEventListener("click", async () => { const type=button.dataset.hunterAction; if(type === "complete" && !confirm("Confirm that you submitted this application?")) return; const slug=document.querySelector(".focus")?.dataset.slug; const response=await fetch("/api/hunter", {method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":token},body:JSON.stringify({type,slug})}); const body=await response.json(); if(response.ok) location.reload(); else alert(body.message); }));
  document.querySelector("#start-session")?.addEventListener("click", async () => { const response = await fetch("/api/hunter", {method:"POST", headers:{"Content-Type":"application/json", "X-CSRF-Token":token}, body:JSON.stringify({type:"start"})}); if(response.ok) location.reload(); else alert((await response.json()).message); });
  document.querySelectorAll("[data-copy]").forEach(button => button.addEventListener("click", async () => { await navigator.clipboard.writeText(document.querySelector(button.dataset.copy).textContent); button.textContent="Copied"; }));
});
