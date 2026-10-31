<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import type { FormInstance } from 'element-plus';
import { request } from '@newlifex/cube-vue/core/utils/request';

// 定义魔方配置类型接口
interface CubeSetting {
  isNew: boolean;
  debug: boolean;
  showRunTime: boolean;
  avatarPath: string;
  avatarChars: number;
  uploadPath: string;
  webRootPath: string;
  resourceUrl: string;
  corsOrigins: string;
  xFrameOptions: string;
  sameSiteMode: number;
  cookieDomain: string;
  shareExpire: number;
  robotError: number;
  forceRedirect: string;
  defaultRole: string;
  allowLogin: boolean;
  allowRegister: boolean;
  allowPlainPassword: boolean;
  autoRegister: boolean;
  paswordStrength: string;
  enablePasswordComplexity: boolean;
  maxLoginError: number;
  loginForbiddenTime: number;
  maxLoginErrorBySubnet24: number;
  maxLoginErrorBySubnet16: number;
  forceBindUser: boolean;
  forceBindUserCode: boolean;
  forceBindUserMobile: boolean;
  forceBindUserMail: boolean;
  forceBindNickName: boolean;
  useSsoRole: boolean;
  useSsoDepartment: boolean;
  roleRules: string;
  logoutAll: boolean;
  sessionTimeout: number;
  refreshUserPeriod: number;
  ssoSafeDomains: string;
  externalAuthUrl: string;
  jwtSecret: string;
  tokenExpire: number;
  tokenCookie: boolean;
  tokenRefreshThreshold: number;
  validateAttachment: boolean;
  publicAttachmentCategories: string;
  ownerOnlyAttachmentCategories: string;
  startPage: string;
  theme: string;
  skin: string;
  loginTip: string;
  loginLogo: string;
  loginBackground: string;
  formGroupClass: string;
  bootstrapSelect: boolean;
  maxDropDownList: number;
  copyright: string;
  registration: string;
  enableNewUI: boolean;
  eChartsTheme: string;
  titlePrefix: boolean;
  enableTableDoubleClick: boolean;
  starWeb: string;
  aiSwitch: boolean;
  aiProvider: string;
  aiEndpoint: string;
  aiApiKey: string;
  aiModel: string;
  enableOAuthServer: boolean;
  enableTenant: boolean;
  enableUserOnline: number;
  enableUserStat: boolean;
  enableSms: boolean;
  enableMail: boolean;
  captchaScene: number;
  enableMfa: boolean;
  fileStorageProvide: boolean;
  fileStorageFetch: boolean;
  dataRetention: number;
  fileRetention: number;
  fileRetentionSize: number;
  maxExport: number;
  maxBackup: number;
}

const loading = ref(false);
const activeTab = ref('basic');
const formRef = ref<FormInstance | null>(null);

// 验证码场景位掩码（1=登录，2=注册，4=发验证码），用于复选框组与表单字段互转
const captchaSceneChecks = computed<number[]>({
  get: () => {
    const v = form.captchaScene || 0;
    const arr: number[] = [];
    if (v & 1) arr.push(1);
    if (v & 2) arr.push(2);
    if (v & 4) arr.push(4);
    return arr;
  },
  set: (val) => {
    form.captchaScene = (val || []).reduce((a, b) => a + b, 0);
  },
});

// 表单数据
const form = reactive<CubeSetting>({
  isNew: false,
  debug: true,
  showRunTime: true,
  avatarPath: 'Avatars',
  avatarChars: 2,
  uploadPath: 'Uploads',
  webRootPath: 'wwwroot',
  resourceUrl: '',
  corsOrigins: '',
  xFrameOptions: '',
  sameSiteMode: -1,
  cookieDomain: '',
  shareExpire: 7200,
  robotError: 0,
  forceRedirect: '',
  defaultRole: '普通用户',
  allowLogin: true,
  allowRegister: true,
  allowPlainPassword: true,
  autoRegister: true,
  paswordStrength: '',
  enablePasswordComplexity: true,
  maxLoginError: 5,
  loginForbiddenTime: 300,
  maxLoginErrorBySubnet24: 10,
  maxLoginErrorBySubnet16: 20,
  forceBindUser: true,
  forceBindUserCode: true,
  forceBindUserMobile: true,
  forceBindUserMail: true,
  forceBindNickName: true,
  useSsoRole: true,
  useSsoDepartment: true,
  roleRules: '',
  logoutAll: true,
  sessionTimeout: 0,
  refreshUserPeriod: 600,
  ssoSafeDomains: '',
  externalAuthUrl: '',
  jwtSecret: '',
  tokenExpire: 7200,
  tokenCookie: false,
  tokenRefreshThreshold: 900,
  validateAttachment: true,
  publicAttachmentCategories: '',
  ownerOnlyAttachmentCategories: '',
  startPage: '',
  theme: '',
  skin: '',
  loginTip: '',
  loginLogo: '',
  loginBackground: '',
  formGroupClass: 'form-group col-xs-12 col-sm-6',
  bootstrapSelect: true,
  maxDropDownList: 50,
  copyright: '',
  registration: '',
  enableNewUI: false,
  eChartsTheme: '',
  titlePrefix: true,
  enableTableDoubleClick: true,
  starWeb: '',
  aiSwitch: false,
  aiProvider: 'NewLifeAI',
  aiEndpoint: 'https://ai.newlifex.com',
  aiApiKey: 'sk-CubeAI2026',
  aiModel: 'newlife-flash',
  enableOAuthServer: true,
  enableTenant: false,
  enableUserOnline: 2,
  enableUserStat: true,
  enableSms: false,
  enableMail: false,
  captchaScene: 0,
  enableMfa: false,
  fileStorageProvide: true,
  fileStorageFetch: true,
  dataRetention: 30,
  fileRetention: 15,
  fileRetentionSize: 1024,
  maxExport: 1000000,
  maxBackup: 10000000,
});

// 加载配置数据
const loadData = async () => {
  loading.value = true;
  try {
    const response = await request.get('/Admin/Cube');

    if (response && response.data) {
      const data = response.data.data || response.data;
      Object.assign(form, data);
    }
  } catch (error) {
    ElMessage.error('加载配置失败');
    console.error('加载配置失败:', error);
  } finally {
    loading.value = false;
  }
};

// 保存配置
const handleSave = async () => {
  try {
    loading.value = true;
    await request.put('/Admin/Cube', form);
    ElMessage.success('保存配置成功');
  } catch (error) {
    ElMessage.error('保存配置失败');
    console.error('保存配置失败:', error);
  } finally {
    loading.value = false;
  }
};

// 初始化加载数据
onMounted(() => {
  loadData();
});
</script>

<template>
  <SettingsPage />
</template>
