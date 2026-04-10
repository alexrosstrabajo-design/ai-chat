import { useState, useRef, useEffect } from "react";
import * as THREE from "three";

const MAX_COLORS = 8;

const frag = `
#define MAX_COLORS 8
uniform vec2 uCanvas;
uniform float uTime;
uniform float uSpeed;
uniform vec2 uRot;
uniform int uColorCount;
uniform vec3 uColors[8];
uniform int uTransparent;
uniform float uScale;
uniform float uFrequency;
uniform float uWarpStrength;
uniform vec2 uPointer;
uniform float uMouseInfluence;
uniform float uParallax;
uniform float uNoise;
varying vec2 vUv;

void main() {
  float t = uTime * uSpeed;
  vec2 p = vUv * 2.0 - 1.0;
  p += uPointer * uParallax * 0.1;
  vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
  vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);
  q /= max(uScale, 0.0001);
  q /= 0.5 + 0.2 * dot(q, q);
  q += 0.2 * cos(t) - 7.56;
  vec2 toward = (uPointer - rp);
  q += toward * uMouseInfluence * 0.2;
  vec3 col = vec3(0.0);
  float a = 1.0;
  if (uColorCount > 0) {
    vec2 s = q;
    vec3 sumCol = vec3(0.0);
    float cover = 0.0;
    for (int i = 0; i < 8; ++i) {
      if (i >= uColorCount) break;
      s -= 0.01;
      vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
      float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);
      float kBelow = clamp(uWarpStrength, 0.0, 1.0);
      float kMix = pow(kBelow, 0.3);
      float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
      vec2 disp = (r - s) * kBelow;
      vec2 warped = s + disp * gain;
      float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(i)) / 4.0);
      float m = mix(m0, m1, kMix);
      float w = 1.0 - exp(-6.0 / exp(6.0 * m));
      sumCol += uColors[i] * w;
      cover = max(cover, w);
    }
    col = clamp(sumCol, 0.0, 1.0);
    a = uTransparent > 0 ? cover : 1.0;
  } else {
    vec2 s = q;
    for (int k = 0; k < 3; ++k) {
      s -= 0.01;
      vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
      float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(k)) / 4.0);
      float kBelow = clamp(uWarpStrength, 0.0, 1.0);
      float kMix = pow(kBelow, 0.3);
      float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
      vec2 disp = (r - s) * kBelow;
      vec2 warped = s + disp * gain;
      float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(k)) / 4.0);
      float m = mix(m0, m1, kMix);
      col[k] = 1.0 - exp(-6.0 / exp(6.0 * m));
    }
    a = uTransparent > 0 ? max(max(col.r, col.g), col.b) : 1.0;
  }
  if (uNoise > 0.0001) {
    float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);
    col += (n - 0.5) * uNoise;
    col = clamp(col, 0.0, 1.0);
  }
  vec3 rgb = (uTransparent > 0) ? col * a : col;
  gl_FragColor = vec4(rgb, a);
}
`;

const vert = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

function ColorBends({ className = "", style, rotation = 45, speed = 0.2, colors = [], transparent = false, autoRotate = 0, scale = 1, frequency = 1, warpStrength = 1, mouseInfluence = 1, parallax = 0.5, noise = 0.08 }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const rafRef = useRef(null);
  const materialRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const rotationRef = useRef(rotation);
  const autoRotateRef = useRef(autoRotate);
  const pointerTargetRef = useRef(new THREE.Vector2(0, 0));
  const pointerCurrentRef = useRef(new THREE.Vector2(0, 0));

  useEffect(() => {
    const container = containerRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);
    const uColorsArray = Array.from({ length: MAX_COLORS }, () => new THREE.Vector3(0, 0, 0));
    const material = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag,
      uniforms: {
        uCanvas: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uSpeed: { value: speed },
        uRot: { value: new THREE.Vector2(1, 0) }, uColorCount: { value: 0 }, uColors: { value: uColorsArray },
        uTransparent: { value: transparent ? 1 : 0 }, uScale: { value: scale }, uFrequency: { value: frequency },
        uWarpStrength: { value: warpStrength }, uPointer: { value: new THREE.Vector2(0, 0) },
        uMouseInfluence: { value: mouseInfluence }, uParallax: { value: parallax }, uNoise: { value: noise },
      },
      premultipliedAlpha: true, transparent: true,
    });
    materialRef.current = material;
    scene.add(new THREE.Mesh(geometry, material));
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", alpha: true });
    rendererRef.current = renderer;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, transparent ? 0 : 1);
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block;";
    container.appendChild(renderer.domElement);
    const clock = new THREE.Clock();
    const handleResize = () => {
      const w = container.clientWidth || 1, h = container.clientHeight || 1;
      renderer.setSize(w, h, false);
      material.uniforms.uCanvas.value.set(w, h);
    };
    handleResize();
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(handleResize);
      ro.observe(container);
      resizeObserverRef.current = ro;
    } else window.addEventListener("resize", handleResize);
    const loop = () => {
      const dt = clock.getDelta(), elapsed = clock.elapsedTime;
      material.uniforms.uTime.value = elapsed;
      const deg = (rotationRef.current % 360) + autoRotateRef.current * elapsed;
      const rad = (deg * Math.PI) / 180;
      material.uniforms.uRot.value.set(Math.cos(rad), Math.sin(rad));
      pointerCurrentRef.current.lerp(pointerTargetRef.current, Math.min(1, dt * 8));
      material.uniforms.uPointer.value.copy(pointerCurrentRef.current);
      renderer.render(scene, camera);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
      else window.removeEventListener("resize", handleResize);
      geometry.dispose(); material.dispose(); renderer.dispose();
      if (renderer.domElement?.parentElement === container) container.removeChild(renderer.domElement);
    };
  }, [frequency, mouseInfluence, noise, parallax, scale, speed, transparent, warpStrength]);

  useEffect(() => {
    const mat = materialRef.current;
    if (!mat) return;
    rotationRef.current = rotation; autoRotateRef.current = autoRotate;
    mat.uniforms.uSpeed.value = speed; mat.uniforms.uScale.value = scale;
    mat.uniforms.uFrequency.value = frequency; mat.uniforms.uWarpStrength.value = warpStrength;
    mat.uniforms.uMouseInfluence.value = mouseInfluence; mat.uniforms.uParallax.value = parallax;
    mat.uniforms.uNoise.value = noise;
    const toVec3 = hex => {
      const h = hex.replace("#", "").trim();
      const v = h.length === 3
        ? [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)]
        : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      return new THREE.Vector3(v[0] / 255, v[1] / 255, v[2] / 255);
    };
    const arr = (colors || []).filter(Boolean).slice(0, MAX_COLORS).map(toVec3);
    for (let i = 0; i < MAX_COLORS; i++) {
      const vec = mat.uniforms.uColors.value[i];
      if (i < arr.length) vec.copy(arr[i]); else vec.set(0, 0, 0);
    }
    mat.uniforms.uColorCount.value = arr.length;
    mat.uniforms.uTransparent.value = transparent ? 1 : 0;
    if (rendererRef.current) rendererRef.current.setClearColor(0x000000, transparent ? 0 : 1);
  }, [rotation, autoRotate, speed, scale, frequency, warpStrength, mouseInfluence, parallax, noise, colors, transparent]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onMove = e => {
      const rect = container.getBoundingClientRect();
      pointerTargetRef.current.set(((e.clientX - rect.left) / (rect.width || 1)) * 2 - 1, -(((e.clientY - rect.top) / (rect.height || 1)) * 2 - 1));
    };
    container.addEventListener("pointermove", onMove);
    return () => container.removeEventListener("pointermove", onMove);
  }, []);

  return <div ref={containerRef} className={className} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", ...style }} />;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are a helpful, concise AI assistant embedded in a web app. Be direct and useful.`;

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "12px 16px" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#fff", animation: "bounce 1.2s infinite", animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12, animation: "fadeIn 0.25s ease-out" }}>
      {!isUser && (
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, marginRight: 8, flexShrink: 0, marginTop: 2 }}>✦</div>
      )}
      <div style={{
        maxWidth: "72%", padding: "10px 15px",
        borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
        background: isUser ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.5)",
        color: isUser ? "#0a0a0a" : "#ffffff",
        fontSize: 14, lineHeight: 1.65,
        backdropFilter: "blur(20px)",
        border: isUser ? "1px solid rgba(255,255,255,0.5)" : "1px solid rgba(255,255,255,0.12)",
        boxShadow: isUser ? "0 4px 20px rgba(0,0,0,0.3)" : "0 2px 12px rgba(0,0,0,0.4)",
        whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word", fontFamily: "'DM Sans',sans-serif",
      }}>{msg.content}</div>
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading return;
    const updated = [...messages, { role: "user", content: text }];
    setMessages(updated); setInput(""); setLoading(true); setError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system: SYSTEM_PROMPT, messages: updated }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Failed to reach Automator.");
      }

      // Add an empty assistant message immediately — we'll stream content into it
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);
      setStreaming(false); // reset in case of retry

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE lines look like: "data: {...}\n\n"
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep any partial last line for next iteration

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;
          try {
            const json = JSON.parse(trimmed.slice(6));
            const token = json.choices?.[0]?.delta?.content;
            if (token) {
              setStreaming(true);
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                  ...copy[copy.length - 1],
                  content: copy[copy.length - 1].content + token,
                };
                return copy;
              });
            }
          } catch { /* skip malformed chunks */ }
        }
      }
    } catch (e) {
      setError(e.message || "Failed to reach Automator.");
    } finally {
      setLoading(false);
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}body{background:#000;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-6px);opacity:1}}
        textarea:focus{outline:none;}
        ::placeholder{color:rgba(255,255,255,0.35);}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:2px}
      `}</style>

      <div style={{ height: "100vh", overflow: "hidden", position: "relative" }}>

        {/* ColorBends — vivid neon colors matching screenshot */}
        <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
          <ColorBends
            colors={["#00e5ff", "#0055ff", "#ff00aa", "#00ff88", "#7700ff", "#ff6600", "#00ffff", "#ff0066"]}
            speed={0.18}
            rotation={35}
            autoRotate={2}
            scale={0.9}
            frequency={1.1}
            warpStrength={1.2}
            mouseInfluence={1.0}
            parallax={0.5}
            noise={0.08}
            transparent={false}
          />
        </div>

        {/* Chat panel */}
        <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", height: "100vh" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(24px)", background: "rgba(0,0,0,0.35)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(12px)", border: "1px solid rgba(255, 255, 255, 1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>AR</div>
              <div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: "#ffffff", letterSpacing: "-0.02em" }}>Automator by Alex</div>
                <div style={{ fontSize: 11, color: loading ? "#fbbf24" : "rgba(255,255,255,0.5)", letterSpacing: "0.08em" }}>{loading ? "THINKING..." : "ONLINE"}</div>
              </div>
            </div>
            {messages.length > 0 && (
              <button onClick={() => { setMessages([]); setError(null); }} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.6)", padding: "6px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Clear</button>
            )}
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
            {messages.length === 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, animation: "fadeIn 0.5s ease-out" }}>
                <div style={{ fontSize: 36 }}>✦</div>
                <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 28, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.04em", textAlign: "center", textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}>What can I automate?</div>
                <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, textAlign: "center", maxWidth: 260, lineHeight: 1.7 }}>
                  Ask me anything — connected directly to Automator.
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8, maxWidth: 360 }}>
                  {["Explain async/await in JS", "Write a haiku about code", "What's the MCP protocol?"].map(s => (
                    <button key={s} onClick={() => setInput(s)} style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.8)", padding: "8px 16px", borderRadius: 20, fontSize: 12, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", backdropFilter: "blur(12px)" }}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
            {loading && !streaming && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, marginRight: 8, flexShrink: 0 }}>✦</div>
                <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "18px 18px 18px 4px", backdropFilter: "blur(20px)" }}><TypingIndicator /></div>
              </div>
            )}
            {error && <div style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,80,80,0.4)", color: "#fca5a5", padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "14px 20px 20px", borderTop: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(24px)", background: "rgba(0,0,0,0.35)" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <textarea
                ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder="Message Automator..." rows={1}
                style={{ flex: 1, background: "transparent", border: "none", color: "#ffffff", fontSize: 14, resize: "none", fontFamily: "'DM Sans',sans-serif", lineHeight: 1.5, maxHeight: 120, overflowY: "auto", paddingTop: 2 }}
                onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
              />
              <button onClick={sendMessage} disabled={!input.trim() || loading} style={{ width: 36, height: 36, borderRadius: 10, background: input.trim() && !loading ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.1)", border: "none", color: input.trim() && !loading ? "#000" : "rgba(255,255,255,0.3)", cursor: input.trim() && !loading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, transition: "all 0.2s", fontWeight: "bold" }}>↑</button>
            </div>
            <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.2)", marginTop: 8, letterSpacing: "0.04em" }}>ENTER to send · SHIFT+ENTER for newline</div>
          </div>
        </div>
      </div>
    </>
  );
}