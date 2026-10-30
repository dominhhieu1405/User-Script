
// ==UserScript==
// @name         TruyenQQ - Chọn phạm vi bình luận
// @namespace    https://truyenqqko.com/
// @version      1.0.2
// @description  Chuyển giữa bình luận của trang hiện tại và tất cả bình luận của truyện.
// @author       Luce
// @match        https://truyenqqko.com/truyen-tranh/*
// @match        https://www.truyenqqko.com/truyen-tranh/*
// @match        https://truyenggvn.com/truyen-tranh/*
// @match        https://www.truyenggvn.com/truyen-tranh/*
// @updateURL    https://raw.githubusercontent.com/dominhhieu1405/User-Script/refs/heads/main/TruyenQQ/comments.js
// @downloadURL  https://raw.githubusercontent.com/dominhhieu1405/User-Script/refs/heads/main/TruyenQQ/comments.js
// @run-at       document-idle
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';

    const pageWindow = unsafeWindow;
    const COOKIE_NAME = 'truyenqq_comment_scope';
    const MODE_PAGE = 'page';
    const MODE_ALL = 'all';

    // Đọc giá trị cookie để khôi phục chế độ bình luận đã chọn.
    function getCookie(name) {
        const prefix = `${encodeURIComponent(name)}=`;
        const item = document.cookie
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith(prefix));

        return item ? decodeURIComponent(item.slice(prefix.length)) : null;
    }

    // Lưu chế độ bình luận trong 1 năm.
    function setCookie(name, value) {
        document.cookie = [
            `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
            'path=/',
            'max-age=31536000',
            'SameSite=Lax',
            'Secure'
        ].join('; ');
    }

    function init() {
        const $ = pageWindow.jQuery;
        const title = document.querySelector('#comment_list .story-detail-title');

        // Chờ jQuery, tiêu đề truyện và hàm loadComment của website sẵn sàng.
        if (!$ || !title || typeof pageWindow.loadComment !== 'function') {
            window.setTimeout(init, 250);
            return;
        }

        // Tránh khởi tạo nhiều lần.
        if (document.querySelector('#truyenqq-comment-scope')) {
            return;
        }

        // Lưu hàm loadComment gốc để sử dụng khi xem bình luận trang hiện tại.
        const originalLoadComment = pageWindow.loadComment;

        // Khôi phục chế độ đã chọn từ cookie.
        const savedMode = getCookie(COOKIE_NAME);
        let mode = savedMode === MODE_ALL ? MODE_ALL : MODE_PAGE;

        // CSS cho hộp chọn phạm vi bình luận.
        const style = document.createElement('style');
        style.textContent = `
            #truyenqq-comment-scope {
                float: right;
                min-width: 155px;
                margin: -3px 0 8px 12px;
                padding: 5px 28px 5px 9px;
                border: 1px solid #d6d6d6;
                border-radius: 4px;
                background-color: #fff;
                color: #333;
                font: inherit;
                font-size: 14px;
                cursor: pointer;
            }

            @media (max-width: 480px) {
                #truyenqq-comment-scope {
                    min-width: 140px;
                    font-size: 13px;
                }
            }
        `;
        document.head.appendChild(style);

        // Tạo hộp chọn phạm vi bình luận bên cạnh tiêu đề.
        const select = document.createElement('select');
        select.id = 'truyenqq-comment-scope';
        select.setAttribute('aria-label', 'Phạm vi bình luận');
        select.innerHTML = `
            <option value="${MODE_PAGE}">Chỉ trang này</option>
            <option value="${MODE_ALL}">Tất cả bình luận</option>
        `;
        select.value = mode;
        title.insertAdjacentElement('afterend', select);

        // Khởi tạo lại các tính năng bổ trợ sau khi thay nội dung bình luận.
        function refreshCommentEnhancements() {
            const comments = $('.list-comment .content-comment');

            // Cho phép thu gọn và mở rộng nội dung bình luận dài.
            if (typeof comments.readmore === 'function') {
                comments.readmore({
                    maxHeight: 105,
                    speed: 100,
                    moreLink: '<p class="readmore"><a href="#">Xem Thêm</a></p>',
                    lessLink: '<p class="readmore"><a href="#">Rút Gọn</a></p>',
                    embedCSS: true,
                    sectionCSS: 'display: block; width: 100%;',
                    startOpen: false,
                    expandedClass: 'readmore-js-expanded',
                    collapsedClass: 'readmore-js-collapsed'
                });
            }

            // Tải lại các nội dung hình ảnh lazy load.
            if (typeof pageWindow.lazyload === 'function') {
                pageWindow.lazyload();
            }
        }

        // Tải bình luận của toàn bộ truyện, không giới hạn theo chapter.
        function loadAllComments(page) {
            const data = {
                book_id: $('#book_id').val(),
                parent_id: 0,
                page: page,
                team_id: $('#team_id').val()
            };

            // Không truyền episode_id để server trả về bình luận toàn bộ truyện.
            $.ajax({
                method: 'POST',
                url: pageWindow.urlCommentLoad || '/frontend/comment/list',
                data: data
            }).done(function (html) {
                $('.list-comment').html(html);
                refreshCommentEnhancements();
            });
        }

        // Ghi đè hàm global để các nút phân trang tự động sử dụng đúng chế độ.
        // Website sử dụng onclick="loadComment(n)" cho các nút chuyển trang.
        pageWindow.loadComment = function (page) {
            if (mode === MODE_ALL) {
                loadAllComments(page);
            } else {
                originalLoadComment(page);
            }
        };

        // Xử lý khi người dùng thay đổi phạm vi bình luận.
        select.addEventListener('change', function () {
            mode = select.value === MODE_ALL ? MODE_ALL : MODE_PAGE;

            // Lưu lựa chọn để giữ nguyên khi tải lại trang hoặc chuyển chapter.
            setCookie(COOKIE_NAME, mode);

            // Tải lại bình luận từ trang đầu tiên theo chế độ mới.
            pageWindow.loadComment(1);
        });

        // Nội dung mặc định do server render sẵn.
        // Chỉ cần gọi AJAX nếu người dùng đã chọn xem toàn bộ bình luận.
        if (mode === MODE_ALL) {
            pageWindow.loadComment(1);
        }
    }

    // Bắt đầu khởi tạo userscript.
    init();
})();
