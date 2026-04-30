import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://qhkckodhjvnuoablpfwq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoa2Nrb2RoanZudW9hYmxwZndxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMjAwNzcsImV4cCI6MjA5MjU5NjA3N30.ifETbDHuaqlSUOl20SFLCAFzzuBbaqhc_bglCCa1LrU";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

const rememberedEmail = localStorage.getItem("agromart_remember_email") || "";
const savedToken = sessionStorage.getItem("agromart_token");
const savedUser = sessionStorage.getItem("agromart_user");

if (savedToken && savedUser) {
  window.location.replace("/dashboard");
}

const slides = Array.from(document.querySelectorAll(".hero-slide"));
const dots = Array.from(document.querySelectorAll(".hero-dot"));
let activeSlide = 0;
let slideTimer = null;

function setSlide(index) {
  if (!slides.length) return;
  activeSlide = (index + slides.length) % slides.length;

  slides.forEach((slide, i) => {
    slide.classList.toggle("is-active", i === activeSlide);
  });

  dots.forEach((dot, i) => {
    dot.classList.toggle("is-active", i === activeSlide);
  });
}

function startCarousel() {
  if (slideTimer) {
    window.clearInterval(slideTimer);
  }
  slideTimer = window.setInterval(() => {
    setSlide(activeSlide + 1);
  }, 4600);
}

dots.forEach((dot) => {
  dot.addEventListener("click", () => {
    const to = Number(dot.dataset.go || 0);
    setSlide(to);
    startCarousel();
  });
});

setSlide(0);
startCarousel();

const form = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const rememberMeInput = document.getElementById("rememberMe");
const togglePasswordBtn = document.getElementById("togglePassword");
const emailHint = document.getElementById("emailHint");
const passwordHint = document.getElementById("passwordHint");
const globalError = document.getElementById("globalError");
const loginBtn = document.getElementById("loginBtn");
const btnText = document.getElementById("btnText");
const btnSpinner = document.getElementById("btnSpinner");

if (rememberedEmail) {
  emailInput.value = rememberedEmail;
  rememberMeInput.checked = true;
}

function clearErrors() {
  globalError.classList.remove("show");
  globalError.textContent = "";
  emailHint.textContent = "";
  passwordHint.textContent = "";
  emailInput.classList.remove("err-field");
  passwordInput.classList.remove("err-field");
}

function setLoading(isLoading) {
  loginBtn.disabled = isLoading;
  btnSpinner.style.display = isLoading ? "inline-block" : "none";
  btnText.textContent = isLoading ? "Signing in..." : "Login to Dashboard";
}

function showError(message) {
  globalError.textContent = message;
  globalError.classList.add("show");
}

function validateForm() {
  clearErrors();

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  let valid = true;

  if (!email) {
    emailInput.classList.add("err-field");
    emailHint.textContent = "Email is required.";
    valid = false;
  }

  if (!password) {
    passwordInput.classList.add("err-field");
    passwordHint.textContent = "Password is required.";
    valid = false;
  }

  return valid;
}

function togglePasswordVisibility() {
  const isVisible = passwordInput.type === "text";
  passwordInput.type = isVisible ? "password" : "text";
  togglePasswordBtn.textContent = isVisible ? "Show" : "Hide";
  togglePasswordBtn.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
  togglePasswordBtn.setAttribute("aria-pressed", String(!isVisible));
  togglePasswordBtn.classList.toggle("active", !isVisible);
}

togglePasswordBtn.addEventListener("click", togglePasswordVisibility);

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!validateForm()) {
    return;
  }

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  setLoading(true);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      showError(error.message || "Login failed. Please try again.");
      setLoading(false);
      return;
    }

    if (!data.session || !data.user) {
      showError("Login failed. No valid session returned.");
      setLoading(false);
      return;
    }

    sessionStorage.setItem("agromart_user", JSON.stringify(data.user));
    sessionStorage.setItem("agromart_token", data.session.access_token);

    if (rememberMeInput.checked) {
      localStorage.setItem("agromart_remember_email", email);
    } else {
      localStorage.removeItem("agromart_remember_email");
    }

    window.location.replace("/dashboard");
  } catch (_error) {
    showError("Server/network error. Please check your connection.");
    setLoading(false);
  }
});

[emailInput, passwordInput].forEach((input) => {
  input.addEventListener("input", () => {
    if (globalError.classList.contains("show")) {
      clearErrors();
    }
  });
});
