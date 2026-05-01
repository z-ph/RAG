import { createRouter, createWebHistory } from "vue-router";
import ChatPage from "../views/ChatPage.vue";
import AdminPage from "../views/AdminPage.vue";

const router = createRouter({
  history: createWebHistory(import.meta.env.VITE_BASE_ROUTE || "/"),
  routes: [
    {
      path: "/",
      name: "Chat",
      component: ChatPage
    },
    {
      path: "/admin",
      component: AdminPage,
      children: [
        {
          path: "",
          name: "AdminDashboard",
          component: () => import("../components/admin/AdminDashboard.vue")
        },
        {
          path: "users",
          name: "UserManagement",
          component: () => import("../components/admin/UserManagement.vue")
        },
        {
          path: "roles",
          name: "RoleManagement",
          component: () => import("../components/admin/RoleManagement.vue")
        },
        {
          path: "permissions",
          name: "PermissionManagement",
          component: () => import("../components/admin/PermissionManagement.vue")
        },
        {
          path: "registration-codes",
          name: "RegistrationCodeManagement",
          component: () => import("../components/admin/RegistrationCodeManagement.vue")
        },
        {
          path: "prompts",
          name: "PromptManagement",
          component: () => import("../components/admin/PromptManagement.vue")
        },
        {
          path: "change-password",
          name: "ChangePassword",
          component: () => import("../components/admin/ChangePassword.vue")
        }
      ]
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: "/"
    }
  ]
});

export default router;
