/**
 * SSPKS 上传页面 JavaScript
 * 用于处理 SPK 包文件的选择、解析和上传功能
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[upload.js] DOM Content Loaded');
  initUpload();
});

let currentFile = null;
let currentInfo = null;
let currentIconUrl = null;

/**
 * 初始化上传功能
 * 绑定事件监听器并设置初始状态
 */
function initUpload() {
  console.log('[upload.js] initUpload() - 初始化上传功能');
  
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const apiKeyInput = document.getElementById('apiKey');
  const overwriteCheck = document.getElementById('overwriteCheck');
  const packageInfoPanel = document.getElementById('packageInfoPanel');
  const packageInfoContent = document.getElementById('packageInfoContent');
  const progressArea = document.getElementById('progressArea');
  const progressPercent = document.getElementById('progressPercent');
  const progressFill = document.getElementById('progressFill');
  const resultArea = document.getElementById('resultArea');

  console.log('[upload.js] 查找 DOM 元素:', {
    fileInput: !!fileInput,
    uploadBtn: !!uploadBtn,
    apiKeyInput: !!apiKeyInput,
    overwriteCheck: !!overwriteCheck,
    packageInfoPanel: !!packageInfoPanel,
    packageInfoContent: !!packageInfoContent,
    progressArea: !!progressArea,
    progressPercent: !!progressPercent,
    progressFill: !!progressFill,
    resultArea: !!resultArea
  });

  if (!fileInput || !uploadBtn) {
    console.error('[upload.js] 必要的 DOM 元素未找到!');
    return;
  }

  /**
   * 文件选择变化事件处理
   * 当用户选择文件时触发
   */
  fileInput.addEventListener('change', async (e) => {
    console.log('[upload.js] fileInput change 事件触发');
    const files = e.target.files;
    
    if (files && files.length > 0) {
      const file = files[0];
      console.log('[upload.js] 选择的文件:', file.name, '大小:', file.size, '字节');
      
      if (!file.name.endsWith('.spk')) {
        console.warn('[upload.js] 文件格式错误，不是 .spk 文件');
        alert('请选择 .spk 文件');
        fileInput.value = '';
        resetForm();
        return;
      }

      currentFile = file;
      currentIconUrl = null; // 重置当前图标 URL
      const iconPreview = document.getElementById('iconPreview');
      if (iconPreview) {
        iconPreview.style.display = 'none';
      }
      console.log('[upload.js] currentFile 已设置');

      if (packageInfoPanel && packageInfoContent) {
        packageInfoPanel.style.display = 'block';
        packageInfoContent.innerHTML = '<p>正在解析...</p>';
        console.log('[upload.js] 开始解析 SPK 包信息...');
        
        try {
          if (window.SpkParser && window.SpkParser.extractInfo) {
            console.log('[upload.js] 调用 SpkParser.extractInfo()');
            currentInfo = await window.SpkParser.extractInfo(file);
            console.log('[upload.js] 解析结果:', currentInfo);
            
            if (currentInfo) {
              displayPackageInfo(currentInfo, packageInfoContent);
              if (currentInfo._thumbnail && currentInfo.displayname) {
                uploadIcon(currentInfo._thumbnail, currentInfo.displayname);
              }
            } else {
              console.warn('[upload.js] 解析结果为空');
              packageInfoContent.innerHTML = '<p>无法解析文件信息</p>';
            }
          } else {
            console.error('[upload.js] SpkParser 未加载到 window');
            packageInfoContent.innerHTML = '<p>解析器未加载</p>';
          }
        } catch (error) {
          console.error('[upload.js] 解析文件时出错:', error);
          packageInfoContent.innerHTML = '<p>解析出错</p>';
        }
      }
      
      uploadBtn.disabled = false;
      console.log('[upload.js] 上传按钮已启用');
    }
  });

  /**
   * HTML 转义
   * @param {string} text - 要转义的文本
   * @returns {string} 转义后的文本
   */
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 显示包信息
   * @param {Object} info - 包信息对象
   * @param {HTMLElement} container - 显示容器
   */
  function displayPackageInfo(info, container) {
    console.log('[upload.js] displayPackageInfo() - 显示包信息');
    let html = '<div class="package-info-preview"><div class="package-icon-preview" id="iconPreview" style="display:none;"><img src="" alt="包图标" class="package-icon" id="iconPreviewImg"></div><div class="info-grid">';
    
    const fields = [
      { key: 'package', label: '包名' },
      { key: 'displayname', label: '显示名称' },
      { key: 'version', label: '版本' },
      { key: 'description', label: '描述' },
      { key: 'arch', label: '架构' },
      { key: 'maintainer', label: '维护者' },
      { key: 'firmware', label: '最低固件' }
    ];

    fields.forEach(field => {
      if (info[field.key]) {
        html += `<div class="info-item"><span class="info-label">${field.label}</span><span class="info-value">${escapeHtml(info[field.key])}</span></div>`;
      }
    });

    html += '</div>';
    container.innerHTML = html;
    console.log('[upload.js] 包信息已渲染到 DOM');
  }

  /**
   * 上传按钮点击事件处理
   * 执行文件上传
   */
  uploadBtn.addEventListener('click', () => {
    console.log('[upload.js] uploadBtn 点击事件触发');

    if (!currentFile) {
      console.warn('[upload.js] 没有选择文件');
      return;
    }

    const formData = new FormData();
    formData.append('spk', currentFile);
    console.log('[upload.js] FormData 已创建，添加文件:', currentFile.name);

    if (currentInfo) {
      formData.append('metadata', JSON.stringify(currentInfo));
      console.log('[upload.js] 已添加 metadata');

      if (currentIconUrl) {
        formData.append('icon_url', currentIconUrl);
        console.log('[upload.js] 已添加 icon_url:', currentIconUrl);
      }
    }

    if (apiKeyInput) {
      formData.append('apiKey', apiKeyInput.value);
      console.log('[upload.js] 已添加 API Key');
    }

    if (overwriteCheck && overwriteCheck.checked) {
      formData.append('overwrite', 'true');
      console.log('[upload.js] 已启用覆盖选项');
    }

    uploadBtn.disabled = true;
    uploadBtn.textContent = '上传中...';
    
    if (progressArea) {
      progressArea.style.display = 'block';
    }
    
    if (resultArea) {
      resultArea.style.display = 'none';
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    console.log('[upload.js] XHR 已打开，目标: /api/upload');
    
    if (apiKeyInput) {
      xhr.setRequestHeader('X-API-Key', apiKeyInput.value);
    }

    /**
     * 上传进度事件处理
     */
    xhr.upload.addEventListener('progress', (e) => {
      console.log('[upload.js] upload progress - 已上传:', e.loaded, '/', e.total);
      
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        
        if (progressPercent) {
          progressPercent.textContent = `${percent}%`;
        }
        
        if (progressFill) {
          progressFill.style.width = `${percent}%`;
        }
      }
    });

    /**
     * XHR 加载完成事件处理
     */
    xhr.addEventListener('load', () => {
      console.log('[upload.js] XHR load 事件 - 状态码:', xhr.status);
      console.log('[upload.js] XHR responseText:', xhr.responseText);

      if (progressArea) {
        progressArea.style.display = 'none';
      }

      if (resultArea) {
        resultArea.style.display = 'block';

        if (xhr.status === 200) {
          console.log('[upload.js] 上传成功!');
          resultArea.className = 'upload-result success';

          try {
            const responseData = JSON.parse(xhr.responseText);
            console.log('[upload.js] 上传响应:', responseData);

            // Display package info with thumbnail if available
            let html = '<div class="success-message"><p>上传成功！</p></div>';
            if (responseData && responseData.package) {
              html += '<div class="upload-result-info"><div class="info-item"><span class="info-label">包名：</span><span class="info-value">' + escapeHtml(String(responseData.package)) + '</span></div>';
              if (responseData.version) {
                html += '<div class="info-item"><span class="info-label">版本：</span><span class="info-value">' + escapeHtml(String(responseData.version)) + '</span></div>';
              }
              if (responseData.arch && Array.isArray(responseData.arch) && responseData.arch.length > 0) {
                html += '<div class="info-item"><span class="info-label">架构：</span><span class="info-value">' + escapeHtml(responseData.arch.join(', ')) + '</span></div>';
              }
              if (responseData.thumbnail_url) {
                html += '<div class="info-item thumbnail-display"><img src="' + escapeHtml(String(responseData.thumbnail_url)) + '" alt="包图标" class="package-icon-display" style="max-width: 120px; max-height: 120px;"/></div>';
              }
              html += '</div>';
            }
            resultArea.innerHTML = html;
            console.log('[upload.js] 结果HTML已设置');
          } catch (e) {
            console.error('[upload.js] 解析响应出错:', e);
            console.log('[upload.js] 原始响应:', xhr.responseText);
            resultArea.innerHTML = '<p>上传成功！</p>';
          }

          resetForm();
        } else {
          console.error('[upload.js] 上传失败:', xhr.status, xhr.responseText);
          resultArea.className = 'upload-result error';
          let errorMsg = xhr.responseText || xhr.statusText;
          if (xhr.status === 401) {
            errorMsg = 'API Key 无效，请检查配置';
          }
          resultArea.innerHTML = `<p>上传失败: ${errorMsg}</p>`;
        }
      }

      uploadBtn.disabled = false;
      uploadBtn.textContent = '上传';
    });

    /**
     * XHR 错误事件处理
     */
    xhr.addEventListener('error', () => {
      console.error('[upload.js] XHR error 事件 - 网络错误');
      
      if (progressArea) {
        progressArea.style.display = 'none';
      }
      
      if (resultArea) {
        resultArea.style.display = 'block';
        resultArea.className = 'upload-result error';
        resultArea.innerHTML = '<p>上传失败: 网络错误</p>';
      }
      
      uploadBtn.disabled = false;
      uploadBtn.textContent = '上传';
    });

    console.log('[upload.js] 发送 XHR...');
    xhr.send(formData);
  });

  /**
   * 上传 icon 到服务器
   */
  async function uploadIcon(iconBlob, displayname) {
    console.log('[upload.js] uploadIcon() - 开始上传 icon');
    const formData = new FormData();
    formData.append('icon', iconBlob, 'package_icon.png');
    formData.append('displayname', displayname);
    if (apiKeyInput) {
      formData.append('apiKey', apiKeyInput.value);
    }

    try {
      const response = await fetch('/api/icon', {
        method: 'POST',
        headers: {
          'X-API-Key': apiKeyInput?.value || ''
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        if (result.icon_url) {
          currentIconUrl = result.icon_url;
          console.log('[upload.js] icon 上传成功:', currentIconUrl);
          const iconPreview = document.getElementById('iconPreview');
          const iconImg = document.getElementById('iconPreviewImg');
          if (iconPreview && iconImg) {
            iconImg.src = currentIconUrl;
            iconPreview.style.display = 'block';
          }
        }
      } else {
        console.warn('[upload.js] icon 上传失败:', response.status);
      }
    } catch (e) {
      console.error('[upload.js] icon 上传出错:', e);
    }
  }

  /**
   * 重置表单状态
   * 清空当前选择的文件和信息
   */
  function resetForm() {
    console.log('[upload.js] resetForm() - 重置表单');
    currentFile = null;
    currentInfo = null;
    currentIconUrl = null;
    fileInput.value = '';
    uploadBtn.disabled = true;

    if (packageInfoPanel) {
      packageInfoPanel.style.display = 'none';
    }

    if (progressPercent) {
      progressPercent.textContent = '0%';
    }
    
    if (progressFill) {
      progressFill.style.width = '0%';
    }
  }
}
