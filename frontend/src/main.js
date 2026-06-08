import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'

const app = createApp(App)
app.component('Toaster', Toaster)
app.mount('#app')
