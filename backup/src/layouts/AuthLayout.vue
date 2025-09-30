<template>
  <div class="auth-layout">
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <div class="logo">
            <div class="logo-icon">
              <Server class="w-8 h-8" />
            </div>
            <h1 class="logo-text">DevOps Platform</h1>
          </div>
          <p class="subtitle">企业级DevOps平台</p>
        </div>
        
        <div class="auth-content">
          <router-view />
        </div>
        
        <div class="auth-footer">
          <p>&copy; 2024 DevOps Platform. All rights reserved.</p>
        </div>
      </div>
    </div>
    
    <!-- Background Animation -->
    <div class="bg-animation">
      <div class="floating-shapes">
        <div class="shape shape-1"></div>
        <div class="shape shape-2"></div>
        <div class="shape shape-3"></div>
        <div class="shape shape-4"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Server } from 'lucide-vue-next'
</script>

<style scoped>
.auth-layout {
  @apply min-h-screen relative overflow-hidden;
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%);
}

.auth-container {
  @apply min-h-screen flex items-center justify-center p-4 relative z-10;
}

.auth-card {
  @apply w-full max-w-md;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(203, 213, 225, 0.3);
  border-radius: 24px;
  padding: 2rem;
  box-shadow: 
    0 20px 25px -5px rgba(0, 0, 0, 0.05),
    0 10px 10px -5px rgba(0, 0, 0, 0.02);
}

.auth-header {
  @apply text-center mb-8;
}

.logo {
  @apply flex items-center justify-center gap-3 mb-4;
}

.logo-icon {
  @apply w-12 h-12 bg-primary-100 rounded-2xl flex items-center justify-center text-primary-600;
}

.logo-text {
  @apply text-2xl font-bold text-soft-800;
}

.subtitle {
  @apply text-soft-600;
}

.auth-content {
  @apply mb-8;
}

.auth-footer {
  @apply text-center text-sm text-soft-500;
}

/* Background Animation */
.bg-animation {
  @apply absolute inset-0 overflow-hidden;
}

.floating-shapes {
  @apply relative w-full h-full;
}

.shape {
  @apply absolute rounded-full opacity-20;
  animation: float 6s ease-in-out infinite;
}

.shape-1 {
  @apply w-64 h-64 bg-primary-200;
  top: 10%;
  left: 10%;
  animation-delay: 0s;
}

.shape-2 {
  @apply w-48 h-48 bg-soft-200;
  top: 60%;
  right: 10%;
  animation-delay: 2s;
}

.shape-3 {
  @apply w-32 h-32 bg-primary-300;
  bottom: 20%;
  left: 20%;
  animation-delay: 4s;
}

.shape-4 {
  @apply w-40 h-40 bg-soft-300;
  top: 30%;
  right: 30%;
  animation-delay: 1s;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0px) rotate(0deg);
  }
  50% {
    transform: translateY(-20px) rotate(180deg);
  }
}

/* Responsive */
@media (max-width: 640px) {
  .auth-card {
    @apply mx-4;
    padding: 1.5rem;
  }
  
  .logo-text {
    @apply text-xl;
  }
  
  .shape {
    @apply opacity-10;
  }
}
</style>