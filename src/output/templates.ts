/**
 * 自动生成的模板文件
 * 由 build.ts 脚本在构建时生成
 */

export const html_modellist = `{{> html_head}}
      <div class="page-header">
        <h1 class="page-title">支持的设备</h1>
        <p class="page-subtitle">选择您的 Synology 设备型号</p>
      </div>

      {{#families}}
      <section class="arch-section">
        <div class="arch-header">
          <span class="arch-badge">
            {{family}}
            <span class="count">{{devices.length}}</span>
          </span>
        </div>
        <div class="device-grid">
          {{#devices}}
          <a href="{{../baseUrlRelative}}?arch={{arch}}" class="device-card">
            <div class="device-info">
              <span class="device-name">{{name}}</span>
              <span class="device-arch">{{arch}}</span>
            </div>
            <span class="device-arrow">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </a>
          {{/devices}}
        </div>
      </section>
      {{/families}}

      {{^families}}
      <div class="empty-state">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        </div>
        <h3>暂未配置设备</h3>
        <p>请检查配置文件</p>
      </div>
      {{/families}}
{{> html_tail}}
`;

export const html_modellist_error = `{{> html_head}}
      <div class="empty-state">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3>出错了</h3>
        <p>{{error}}</p>
        <a href="{{baseUrlRelative}}" class="btn btn-primary" style="margin-top: 16px;">返回首页</a>
      </div>
{{> html_tail}}
`;

export const html_modellist_none = `{{> html_head}}
      <div class="empty-state">
        <div class="empty-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
        </div>
        <h1>暂无设备</h1>
        <p>暂未配置支持的 Synology 设备</p>
        <a href="{{baseUrlRelative}}" class="btn btn-primary">返回首页</a>
      </div>
{{> html_tail}}
`;

export const html_package_detail = `{{> html_head}}
      <script>
        document.addEventListener('DOMContentLoaded', function() {
          function getCookie(name) {
            const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
            return match ? decodeURIComponent(match[2]) : null;
          }
          const lastArch = getCookie('sspks_last_arch');
          if (lastArch) {
            const backLink = document.querySelector('.back-link');
            if (backLink) {
              backLink.href = '{{{baseUrlRelative}}}?arch=' + encodeURIComponent(lastArch);
            }
          }

          const deleteBtn = document.getElementById('deletePackageBtn');
          const deleteModal = document.getElementById('deleteModal');
          const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
          const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
          const deleteApiKeyInput = document.getElementById('deleteApiKey');
          const deleteError = document.getElementById('deleteError');
          const deletePackageName = document.getElementById('deletePackageName');

          if (deleteBtn && deleteModal) {
            deleteBtn.addEventListener('click', function() {
              const packageName = this.dataset.package;
              if (deletePackageName) {
                deletePackageName.textContent = packageName;
              }
              deleteModal.classList.add('active');
              if (deleteApiKeyInput) {
                deleteApiKeyInput.focus();
              }
            });

            cancelDeleteBtn.addEventListener('click', function() {
              deleteModal.classList.remove('active');
              if (deleteError) {
                deleteError.style.display = 'none';
              }
              if (deleteApiKeyInput) {
                deleteApiKeyInput.value = '';
              }
            });

            deleteModal.addEventListener('click', function(e) {
              if (e.target === deleteModal) {
                deleteModal.classList.remove('active');
                if (deleteError) {
                  deleteError.style.display = 'none';
                }
                if (deleteApiKeyInput) {
                  deleteApiKeyInput.value = '';
                }
              }
            });

            confirmDeleteBtn.addEventListener('click', async function() {
              const packageName = deleteBtn.dataset.package;
              const apiKey = deleteApiKeyInput ? deleteApiKeyInput.value.trim() : '';

              if (!apiKey) {
                if (deleteError) {
                  deleteError.textContent = '请输入 API Key';
                  deleteError.style.display = 'block';
                }
                return;
              }

              confirmDeleteBtn.disabled = true;
              confirmDeleteBtn.textContent = '删除中...';
              if (deleteError) {
                deleteError.style.display = 'none';
              }

              try {
                const response = await fetch('{{{baseUrlRelative}}}api/packages/' + encodeURIComponent(packageName), {
                  method: 'DELETE',
                  headers: {
                    'X-API-Key': apiKey
                  }
                });

                if (response.ok) {
                  const arch = lastArch || '';
                  window.location.href = '{{{baseUrlRelative}}}?arch=' + encodeURIComponent(arch);
                } else {
                  const result = await response.json().catch(() => ({}));
                  if (deleteError) {
                    deleteError.textContent = result.error?.message || '删除失败: ' + response.status;
                    deleteError.style.display = 'block';
                  }
                  confirmDeleteBtn.disabled = false;
                  confirmDeleteBtn.textContent = '确认删除';
                }
              } catch (e) {
                if (deleteError) {
                  deleteError.textContent = '网络错误: ' + e.message;
                  deleteError.style.display = 'block';
                }
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.textContent = '确认删除';
              }
            });

            deleteApiKeyInput.addEventListener('keydown', function(e) {
              if (e.key === 'Enter') {
                confirmDeleteBtn.click();
              }
            });
          }
        });
      </script>
      <div class="page-header">
        <a href="{{baseUrlRelative}}?arch={{arch}}" class="back-link">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回设备列表
        </a>
      </div>

      <div class="package-detail">
        <div class="package-detail-header">
          <img src="{{thumbnail}}" alt="{{displayname}}" class="package-detail-icon">
          <div class="package-detail-info">
            <h1 class="package-detail-name">{{displayname}}</h1>
            <span class="package-detail-version">v{{version}}</span>
            {{#beta}}<span class="tag beta">Beta</span>{{/beta}}
            {{#maintainer}}
            <p class="package-detail-description">由 {{maintainer}} 维护</p>
            {{/maintainer}}
          </div>
        </div>

        <div class="package-detail-section">
          <h3>描述</h3>
          <p class="package-detail-description">{{description}}</p>
        </div>

        <div class="package-detail-section">
          <h3>信息</h3>
          <div class="info-grid">
            {{#arch}}
            <div class="info-item">
              <span class="info-label">架构</span>
              <span class="info-value">{{.}}</span>
            </div>
            {{/arch}}
            {{#size}}
            <div class="info-item">
              <span class="info-label">大小</span>
              <span class="info-value">{{size}}</span>
            </div>
            {{/size}}
            {{#checksum}}
            <div class="info-item">
              <span class="info-label">校验和</span>
              <span class="info-value checksum">{{checksum}}</span>
            </div>
            {{/checksum}}
            <div class="info-item">
              <span class="info-label">文件名</span>
              <span class="info-value">{{filename}}</span>
            </div>
          </div>
        </div>

        {{#firmware}}
        <div class="package-detail-section">
          <h3>最低固件版本</h3>
          <p class="info-value">DSM {{firmware}}</p>
        </div>
        {{/firmware}}

        <div class="package-actions">
          <a href="{{spk_url}}" class="btn btn-primary btn-large" download>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            下载 SPK
          </a>
          <button type="button" class="btn btn-danger btn-large" id="deletePackageBtn" data-package="{{package}}">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            删除
          </button>
        </div>
      </div>

      <div class="modal-overlay" id="deleteModal">
        <div class="modal">
          <div class="modal-header">
            <div class="modal-icon danger">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 class="modal-title">确定要删除此包吗？</h2>
          </div>
          <div class="modal-body">
            <p class="modal-message">此操作将永久删除 <strong id="deletePackageName"></strong> 及其所有相关文件，包括：</p>
            <ul class="modal-list">
              <li>SPK 安装包文件</li>
              <li>图标文件</li>
              <li>数据库记录</li>
              <li>缓存数据</li>
            </ul>
            <p class="modal-warning">此操作无法撤销。</p>
            <div class="form-group">
              <label for="deleteApiKey" class="form-label">API Key</label>
              <input type="password" id="deleteApiKey" class="form-input" placeholder="请输入您的 API Key" autocomplete="off">
            </div>
            <div class="delete-error" id="deleteError" style="display: none;"></div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" id="cancelDeleteBtn">取消</button>
            <button type="button" class="btn btn-danger" id="confirmDeleteBtn">确认删除</button>
          </div>
        </div>
      </div>
{{> html_tail}}
`;

export const html_packagelist = `{{> html_head}}
      <script>
        (function() {
          document.addEventListener('click', function(e) {
            const archMatch = e.target.closest('[data-package]');
            if (archMatch) {
              const urlParams = new URLSearchParams(window.location.search);
              const arch = urlParams.get('arch');
              if (arch) {
                document.cookie = 'sspks_last_arch=' + encodeURIComponent(arch) + '; path=/; max-age=86400';
              }
            }
          });
        })();
      </script>
      <div class="page-header">
        <a href="{{baseUrlRelative}}" class="back-link">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回设备列表
        </a>
        <div class="page-header-content">
          <h1 class="page-title">{{family}} 架构</h1>
          <p class="page-subtitle">{{packageCount}} 个可用的 Synology 套件</p>
        </div>
      </div>

      <div class="toolbar">
        <div class="search-box">
          <input type="text" id="searchInput" placeholder="搜索包..." autocomplete="off">
        </div>
        <div class="package-count">
          共 <strong>{{packageCount}}</strong> 个包
        </div>
      </div>

      <div class="package-grid" data-package-list>
        {{#packages}}
        <a href="{{baseUrlRelative}}package/{{package}}" class="package-card" data-package="{{package}}" data-description="{{description}}">
          <img src="{{thumbnail}}" alt="{{displayname}}" class="package-icon">
          <div class="package-content">
            <div class="package-header">
              <h3 class="package-name">{{displayname}}</h3>
              <span class="package-version">v{{version}}</span>
            </div>
            <p class="package-description">{{description}}</p>
            <div class="package-tags">
              <span class="tag arch">{{arch}}</span>
              {{#beta}}<span class="tag beta">Beta</span>{{/beta}}
            </div>
          </div>
        </a>
        {{/packages}}

        {{^packages}}
        <div class="empty-state" data-empty-state>
          <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h3>暂无包</h3>
          <p>该架构下没有可用的套件</p>
        </div>
        {{/packages}}
      </div>
{{> html_tail}}
`;

export const html_packagelist_all = `{{> html_head}}
      <h1 class="page-title">所有包</h1>

      <div class="package-list-all">
        {{#packages}}
        <div class="package-list-item">
          <a href="{{baseUrlRelative}}package/{{package}}" class="package-link">
            <span class="package-name">{{displayname}}</span>
            <span class="package-version">v{{version}}</span>
          </a>
          <a href="{{downloadUrl}}" class="download-link" download>下载</a>
        </div>
        {{/packages}}

        {{^packages}}
        <div class="empty-state">
          <div class="empty-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p>暂无包</p>
        </div>
        {{/packages}}
      </div>
{{> html_tail}}
`;

export const html_upload = `{{> html_head}}
      <div class="page-header">
        <div class="page-header-content">
          <h1 class="page-title">上传 SPK</h1>
          <p class="page-subtitle">上传 Synology 套件包到服务器</p>
        </div>
      </div>

      <div class="upload-card">
        <div class="upload-card-body">
          <div class="form-group">
            <label for="apiKey" class="form-label">API Key</label>
            <input type="password" id="apiKey" class="form-input" placeholder="请输入您的 API Key" autocomplete="off">
            <p class="form-hint">API Key 用于验证上传权限</p>
          </div>

          <div class="form-group form-group-inline">
            <label class="checkbox-label">
              <input type="checkbox" id="overwriteCheck">
              <span class="checkbox-custom"></span>
              <span class="checkbox-text">覆盖已存在的包</span>
            </label>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="fileInput" class="form-label">选择文件</label>
              <input type="file" id="fileInput" class="form-input-file" accept=".spk">
            </div>
            <div class="form-group">
              <label class="form-label">&nbsp;</label>
              <button type="button" class="btn btn-primary" id="uploadBtn" disabled>
                上传
              </button>
            </div>
          </div>

          <div class="package-info-panel" id="packageInfoPanel" style="display: none;">
            <div class="package-info-header">
              <h3>包信息</h3>
            </div>
            <div class="package-info-grid" id="packageInfoContent"></div>
          </div>

          <div class="upload-progress" id="progressArea" style="display: none;">
            <div class="progress-info">
              <span id="progressPercent">0%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" id="progressFill"></div>
            </div>
          </div>

          <div class="upload-result" id="resultArea" style="display: none;"></div>
        </div>
      </div>
{{> html_tail}}
`;

export const partials = {
  "html_head": `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{siteName}}</title>
  <link rel="stylesheet" href="{{themeUrl}}css/style.css">
  <script>
    (function() {
      const stored = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = stored || (prefersDark ? 'dark' : 'light');
      document.documentElement.setAttribute('data-theme', theme);
    })();
  </script>
  <script src="{{themeUrl}}js/script.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js"></script>
  <script src="{{baseUrlRelative}}public/js/spk-parser.js"></script>
  <script src="{{baseUrlRelative}}public/js/upload.js"></script>
</head>
<body>
  <header class="header">
    <div class="container header-container">
      <a href="{{baseUrlRelative}}" class="logo">
        <svg class="logo-icon" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
        <span class="logo-text">{{siteName}}</span>
      </a>
      <nav class="nav" id="mainNav">
        <a href="{{baseUrlRelative}}" class="nav-link">首页</a>
        <a href="{{baseUrlRelative}}upload" class="nav-link">上传</a>
        <button class="theme-toggle" id="themeToggle" aria-label="切换主题">
        <svg class="sun-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <svg class="moon-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      </button>
      </nav>
      <button class="mobile-menu-toggle" id="mobileMenuToggle" aria-label="菜单">
        <span></span>
      </button>
    </div>
  </header>

  <main class="main">
    <div class="container">
`,
  "html_tail": `    </div>
  </main>

  <footer class="footer">
    <div class="container footer-content">
      <p class="footer-text">&copy; {{year}} {{siteName}}</p>
    </div>
  </footer>
</body>
</html>
`
};
