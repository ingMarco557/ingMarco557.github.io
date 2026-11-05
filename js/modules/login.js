/* ============================================================
   modules/login.js · Pantalla de inicio de sesión
   AÑADIDO:
   - Ojo 👁 para mostrar/ocultar la contraseña.
   - Mensaje de ayuda sobre los caracteres del usuario.
   ============================================================ */

import { login } from "../auth.js";
import { toast } from "../ui.js";
import { navega } from "../router.js";

export async function render(root) {
  root.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-logo">Mueblimex</div>
        <div class="login-sub">Sistema de ventas a crédito</div>

        <div class="field">
          <label>USUARIO</label>
          <input type="text" id="edt-usuario" placeholder="ej. vendedor01"
                 autocapitalize="none" autocomplete="username" />
        </div>

        <div class="field">
          <label>CONTRASEÑA</label>
          <div style="position:relative">
            <input type="password" id="edt-password" placeholder="••••••••"
                   autocomplete="current-password"
                   style="padding-right:44px;width:100%;box-sizing:border-box" />
            <button id="btn-ojo" type="button"
                    style="position:absolute;right:12px;top:50%;transform:translateY(-50%);
                           background:none;border:none;cursor:pointer;padding:4px;
                           color:var(--txt2);font-size:18px;line-height:1"
                    aria-label="Mostrar contraseña">
              👁
            </button>
          </div>
        </div>

        <button class="btn btn-primary btn-block mt-8" id="btn-login">
          Iniciar sesión
        </button>

        <p class="muted text-center mt-16" style="font-size:12px">
          ¿Olvidaste tu contraseña? Contacta al gerente.
        </p>
      </div>
    </div>
  `;

  const edtUser  = root.querySelector("#edt-usuario");
  const edtPass  = root.querySelector("#edt-password");
  const btnLogin = root.querySelector("#btn-login");
  const btnOjo   = root.querySelector("#btn-ojo");

  // Ojo: alternar mostrar/ocultar contraseña
  let mostrando = false;
  btnOjo.addEventListener("click", () => {
    mostrando = !mostrando;
    edtPass.type = mostrando ? "text" : "password";
    btnOjo.textContent = mostrando ? "🙈" : "👁";
  });

  async function intentarLogin() {
    const user = edtUser.value.trim();
    const pass = edtPass.value.trim();

    if (!user || !pass) {
      toast("Completa los campos", "warn");
      return;
    }

    btnLogin.disabled = true;
    btnLogin.textContent = "Verificando...";

    try {
      const perfil = await login(user, pass);
      toast(`Bienvenido, ${perfil.nombre}`, "ok");
      navega("inicio");
    } catch (e) {
      console.error(e);
      let msg = "Usuario o contraseña incorrectos";
      if (e.code === "auth/invalid-credential" || e.code === "auth/wrong-password")
        msg = "Usuario o contraseña incorrectos";
      else if (e.code === "auth/user-not-found")
        msg = "Ese usuario no existe";
      else if (e.code === "auth/too-many-requests")
        msg = "Demasiados intentos. Espera un momento.";
      else if (e.code === "auth/network-request-failed")
        msg = "Sin conexión a internet";
      else if (e.message) msg = e.message;
      toast(msg, "err");
      btnLogin.disabled = false;
      btnLogin.textContent = "Iniciar sesión";
    }
  }

  btnLogin.addEventListener("click", intentarLogin);
  edtPass.addEventListener("keydown", (e) => {
    if (e.key === "Enter") intentarLogin();
  });
}
