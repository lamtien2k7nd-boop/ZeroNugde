document.addEventListener('DOMContentLoaded', () => {
  // Intersection Observer for scroll animations
  const observerOptions = {
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('reveal');
      }
    });
  }, observerOptions);

  // Targets for landing page
  const revealTargets = [
    '.hero-content',
    '.offer-grid',
    '.features-container',
    '.benefit-item'
  ];

  revealTargets.forEach(selector => {
    const el = document.querySelector(selector);
    if (el) observer.observe(el);
  });

  // Benefit items have a staggered effect if possible
  document.querySelectorAll('.benefit-item').forEach((item, index) => {
    item.style.transitionDelay = `${index * 0.2}s`;
    observer.observe(item);
  });

  // Auth Page Toggle
  const authContainer = document.querySelector('.auth-container');
  const switchToSignup = document.getElementById('switch-to-signup');
  const switchToLogin = document.getElementById('switch-to-login');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const authVisualTitle = document.getElementById('auth-visual-title');
  const authVisualText = document.getElementById('auth-visual-text');

  if (switchToSignup) {
    switchToSignup.addEventListener('click', () => {
      authContainer.classList.add('signup-mode');
      setTimeout(() => {
        loginForm.classList.add('hidden-form');
        signupForm.classList.remove('hidden-form');
        authVisualTitle.textContent = 'Join Us!';
        authVisualText.textContent = 'Start your journey towards financial freedom today.';
      }, 300);
    });
  }

  if (switchToLogin) {
    switchToLogin.addEventListener('click', () => {
      authContainer.classList.remove('signup-mode');
      setTimeout(() => {
        signupForm.classList.add('hidden-form');
        loginForm.classList.remove('hidden-form');
        authVisualTitle.textContent = 'Welcome Back!';
        authVisualText.textContent = 'We missed you. Log in to continue managing your growth.';
      }, 300);
    });
  }

  // Handle Login Submission
  const loginFormEl = document.getElementById('login-form-el');
  const loginError = document.getElementById('login-error');
  
  if (loginFormEl) {
    loginFormEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      loginError.style.display = 'none';
      
      const formData = new FormData(loginFormEl);
      const data = Object.fromEntries(formData.entries());
      
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
          window.location.href = '/dashboard';
        } else {
          loginError.textContent = result.error || 'Đăng nhập thất bại';
          loginError.style.display = 'block';
        }
      } catch (err) {
        loginError.textContent = 'Lỗi kết nối server';
        loginError.style.display = 'block';
      }
    });
  }

  // Handle Signup Submission
  const signupFormEl = document.getElementById('signup-form-el');
  const signupError = document.getElementById('signup-error');
  
  if (signupFormEl) {
    signupFormEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      signupError.style.display = 'none';
      
      const formData = new FormData(signupFormEl);
      const data = Object.fromEntries(formData.entries());
      
      if (data.password !== data.confirmPassword) {
        signupError.textContent = 'Mật khẩu không khớp';
        signupError.style.display = 'block';
        return;
      }
      
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
          // Switch to login mode
          authContainer.classList.remove('signup-mode');
          setTimeout(() => {
            signupForm.classList.add('hidden-form');
            loginForm.classList.remove('hidden-form');
            authVisualTitle.textContent = 'Welcome Back!';
            authVisualText.textContent = 'Registration successful! Please log in.';
            loginFormEl.reset();
            signupFormEl.reset();
          }, 300);
        } else {
          signupError.textContent = result.error || 'Đăng ký thất bại';
          signupError.style.display = 'block';
        }
      } catch (err) {
        signupError.textContent = 'Lỗi kết nối server';
        signupError.style.display = 'block';
      }
    });
  }
});

// Feature screenshot switcher
function switchFeature(el) {
  // Remove active from all items
  document.querySelectorAll('.feature-item').forEach(item => item.classList.remove('active'));
  // Add active to clicked item
  el.classList.add('active');

  // Swap screenshot with fade
  const img = document.getElementById('feature-screenshot');
  const newSrc = el.getAttribute('data-img');
  if (img && newSrc) {
    img.style.opacity = '0';
    setTimeout(() => {
      img.src = newSrc;
      img.style.opacity = '1';
    }, 300);
  }
}
