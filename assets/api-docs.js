/* global jsyaml */
const byId = (id) => document.getElementById(id);
const esc = (value = "") => String(value).replace(/[&<>'"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]);
const slug = (value) => String(value).replace(/[^a-zA-Z0-9]+/g, "-").replace(/(^-|-$)/g, "").toLowerCase();
const methods = ["get", "post", "put", "patch", "delete"];

function ref(spec, value) { return value?.$ref ? value.$ref.split("/").slice(1).reduce((node, key) => node?.[key], spec) || value : value; }
function schema(spec, value, depth = 0) {
  value = ref(spec, value) || {};
  if (depth > 3) return value.type || "object";
  if (value.example !== undefined) return value.example;
  if (value.enum) return value.enum[0];
  if (value.type === "array") return [schema(spec, value.items, depth + 1)];
  if (value.properties) return Object.fromEntries(Object.entries(value.properties).map(([key, item]) => [key, schema(spec, item, depth + 1)]));
  return ({ integer: 0, number: 0, boolean: false, string: value.format === "date-time" ? "2026-01-01T00:00:00Z" : "string" })[value.type] || "object";
}
function typeOf(spec, item) { item = ref(spec, item) || {}; return item.type || (item.properties ? "object" : item.$ref?.split("/").pop() || "—"); }
function parameters(spec, operation, pathItem) { return [...(pathItem.parameters || []), ...(operation.parameters || [])].map((item) => ref(spec, item)); }
function parameterTable(spec, list) {
  if (!list.length) return "";
  return `<span class="table-label">THAM SỐ</span><div class="table-wrap"><table><thead><tr><th>Tên</th><th>Vị trí</th><th>Kiểu</th><th>Bắt buộc</th><th>Mô tả</th></tr></thead><tbody>${list.map((p) => `<tr><td><code>${esc(p.name)}</code></td><td>${esc(p.in)}</td><td>${esc(typeOf(spec, p.schema))}</td><td class="${p.required ? "required":"optional"}">${p.required ? "Có":"Không"}</td><td>${esc(p.description || "—")}</td></tr>`).join("")}</tbody></table></div>`;
}
function requestBody(spec, body) {
  body = ref(spec, body); if (!body) return "";
  const content = body.content?.["application/json"] || Object.values(body.content || {})[0];
  if (!content) return "";
  const data = schema(spec, content.schema);
  return `<span class="table-label">REQUEST BODY${body.required ? " · BẮT BUỘC" : ""}</span><pre class="code-sample">${esc(JSON.stringify(data, null, 2))}</pre>`;
}
function responses(spec, responses) {
  const rows = Object.entries(responses || {}).map(([code, entry]) => {
    entry = ref(spec, entry); const media = entry.content?.["application/json"] || Object.values(entry.content || {})[0];
    const example = media?.schema ? `<pre class="schema">${esc(JSON.stringify(schema(spec, media.schema), null, 2))}</pre>` : "";
    return `<tr><td class="status">${esc(code)}</td><td>${esc(entry.description || "—")}${example}</td></tr>`;
  }).join("");
  return rows ? `<span class="table-label">RESPONSE</span><div class="table-wrap"><table><thead><tr><th>Mã</th><th>Mô tả / schema</th></tr></thead><tbody>${rows}</tbody></table></div>` : "";
}
function render(spec) {
  byId("api-title").textContent = spec.info.title;
  byId("mobile-title").textContent = spec.info.title;
  byId("hero-title").textContent = spec.info.title;
  byId("hero-description").textContent = spec.info.description || "";
  byId("server-url").textContent = spec.servers?.[0]?.url || "Liên hệ quản trị viên để được cấp URL";
  const security = spec.security?.length ? Object.keys(spec.security[0]).join(", ") : "API không khai báo cơ chế xác thực chung.";
  byId("security-content").innerHTML = `<p>Yêu cầu xác thực: <code>${esc(security)}</code>.</p><p>Gửi thông tin xác thực qua header theo security scheme đã được cấp. Không nhúng token vào ứng dụng client hoặc repository công khai.</p>`;
  const groups = {};
  Object.entries(spec.paths || {}).forEach(([path, pathItem]) => methods.forEach((method) => {
    if (!pathItem[method]) return;
    const op = pathItem[method]; const tag = op.tags?.[0] || "Khác";
    (groups[tag] ||= []).push({ path, pathItem, method, op });
  }));
  const nav = byId("endpoint-nav"), output = byId("endpoints");
  Object.entries(groups).forEach(([tag, endpoints]) => {
    nav.insertAdjacentHTML("beforeend", `<p class="nav-label">${esc(tag)}</p>${endpoints.map(({path, method}) => `<a class="endpoint-link" href="#${slug(`${method}-${path}`)}">${method.toUpperCase()} ${esc(path)}</a>`).join("")}`);
    output.insertAdjacentHTML("beforeend", `<h3 class="tag-heading">${esc(tag)}</h3>${endpoints.map(({path, pathItem, method, op}) => {
      const id = slug(`${method}-${path}`);
      return `<article class="endpoint" id="${id}"><header class="endpoint-top"><div class="method-line"><span class="method ${method}">${method.toUpperCase()}</span><code class="endpoint-path">${esc(path)}</code></div><p class="endpoint-summary">${esc(op.summary || "")}</p></header><div class="endpoint-body">${op.description ? `<p class="endpoint-description">${esc(op.description)}</p>` : ""}${parameterTable(spec, parameters(spec, op, pathItem))}${requestBody(spec, op.requestBody)}${responses(spec, op.responses)}</div></article>`;
    }).join("")}`);
  });
}
async function boot() {
  try { const response = await fetch("openapi.yaml"); if (!response.ok) throw new Error(response.status); render(jsyaml.load(await response.text())); }
  catch (error) { console.error(error); byId("endpoints").append(byId("loading-template").content.cloneNode(true)); }
}
byId("menu-toggle").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));
boot();
