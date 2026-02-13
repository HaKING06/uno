// Güvenli (WSS) ve Güvensiz (WS) bağlantıyı otomatik algıla (Render.com için hayati önem taşır!)
const wsProtocol = location.protocol === 'https:' ? 'wss://' : 'ws://';
const server = new WebSocket(`${wsProtocol}${location.host}/ws`);

const user = {};
const room = { players: [] };

// --- SUNUCU BAĞLANTI DURUMLARI ---
server.onclose = close => {
    $('.error-head .error-title a').text('Bağlantı Koptu');
    $('.error-head .error-desc').text((close && close.reason) || 'Lütfen sayfayı yenileyin!');
    $('.error-close').hide();
    $('#error-container').fadeIn(250);
    location.hash = '';
};

server.onerror = () => {
    $('.error-head .error-title a').text('Bağlantı Hatası');
    $('.error-head .error-desc').text('Bir şeyler ters gitti! Lütfen sayfayı yenileyin.');
    $('.error-close').hide();
    $('#error-container').fadeIn(250);
};

server.onopen = () => {
    $('.loading-container').fadeOut(200, () => {
        $('.menu-container').fadeIn(250);
    });
    
    if (location.hash) {
        server.send(JSON.stringify({ type: 'room_list' }));
        room.roomID = location.hash.replace("#", "");
        server.send(JSON.stringify({ type: "room_check", roomID: room.roomID }));
    }
}

// --- GELEN MESAJLARI İŞLEME ---
server.onmessage = function (event) {
    const data = JSON.parse(event.data);
    
    if (data.type === 'id') user.id = data.id;
    
    if (data.type === 'v') {
        console.log("Game Version: %c" + data.version, 'color: #fbbf24; font-weight: bold;');
        $('.menu-footer').append(`<p>Sürüm: <a target="_blank" href="https://github.com/mrozio13pl/uno/releases/latest">${data.version}</a></p>`);
    }
    
    if (data.type === 'room_list') {
        $('.refresh').attr('disabled', true);
        setTimeout(() => $('.refresh').attr('disabled', false), data.cooldown);
        
        $('.room-list').html('');
        if (!data.rooms.length) return $('.room-list').html('<span style="color:#94a3b8;">Aktif oda bulunamadı :(</span>');
        
        data.rooms.forEach(room => {
            $('.room-list').append(`
                <div class="item" data-id="${room.roomID}">
                    <div><a title="${escapeHtml(room.roomName)}">${escapeHtml(room.roomName)}</a></div>
                    <div><a>Oyuncu: ${room.playerCount}/4</a></div>
                </div>
            `);
        });
        
        $('.room-list .item').click(item => {
            room.roomID = item.currentTarget.getAttribute('data-id');
            server.send(JSON.stringify({ type: "room_check", roomID: room.roomID }));
        });
    }
    
    if (data.type === 'room_check') {
        if (data.callback) {
            $("#menu-screen, #games-container").fadeOut(250, () => {
                $('#nickname').fadeIn(250);
                $('.cancel').fadeIn(250);
                $(".nickname").focus();
            });
            $(".room-settings").hide();
            user.action = 'join';
        } else {
            error('Geçersiz Kod', data.message);
        }
    }
    
    if (data.type === 'my_cards') {
        $('.you .my-cards').html('');
        data.cards.forEach(card => {
            if (!isNaN(card.number) && !card.ability) return $('.you .my-cards').append(`<div class="my-card num-${card.number} ${card.color}" data-ability data-color="${card.color}" data-number=${card.number}><span class="inner"><span class="mark">${card.number}</span></span></div>`);
            if (card.ability === 'plus4') return $('.you .my-cards').append(`<div class="my-card num-plus4 black" data-ability="plus4" data-color data-number><span class="inner"><span class="mark">+4</span></span></div>`);
            if (card.ability === 'plus2') return $('.you .my-cards').append(`<div class="my-card num-plus2 ${card.color}" data-ability="plus2" data-color="${card.color}" data-number><span class="inner"><span class="mark">+2</span></span></div>`);
            if (card.ability === 'reverse') return $('.you .my-cards').append(`<div class="my-card num-reverse ${card.color}" data-ability="reverse" data-color="${card.color}" data-number><span class="inner"><span class="mark"><i class="fa-solid fa-rotate"></i></span></span></div>`);
            if (card.ability === 'block') return $('.you .my-cards').append(`<div class="my-card num-block ${card.color}" data-ability="block" data-color="${card.color}" data-number><span class="inner"><span class="mark"><i class="fa-solid fa-ban"></i></span></span></div>`);
            if (card.ability === 'change') return $('.you .my-cards').append(`<div class="my-card num-change black" data-ability="change" data-color data-number><span class="inner"><span class="mark"><div class="change"><div class="segment yellow"></div><div class="segment green"></div><div class="segment blue"></div><div class="segment red"></div></div></span></span></div>`);
        });
        
        $('.my-cards .my-card').click(card => {
            user.push = {
                ability: card.currentTarget.getAttribute('data-ability') || null,
                color: card.currentTarget.getAttribute('data-color') || null,
                number: card.currentTarget.getAttribute('data-number') || null,
            };
            if (user.push.ability === 'change' || user.push.ability === 'plus4') {
                $(".color-selector-container").fadeIn(200);
            } else {
                server.send(JSON.stringify({ type: 'action', card: user.push, action: 'place' }));
            }
        });
        
        if (user.countdown) clearInterval(user.countdown);
        $('.timeout').text('');
    }
    
    if (data.type === 'created_room') {
        $('.code h1').text(data.id);
        $('.limbo-admin').fadeIn(250);
    }
    
    if (data.type === 'joined_room') {
        $('#nickname').fadeOut(250, () => {
            $('#limbo').fadeIn(250);
        });
        $('#room-code').text(data.id);
        location.hash = data.id;
        user.isConnected = true;
    }
    
    if (data.type === 'room') {
        if (!data.room.isRunning) {
            if (room.players.length !== data.room.players.length || user.roomID !== data.room.roomID) {
                room.players = data.room.players;
                user.roomID = room.roomID;
                $('.limbo-player-list').html('');
                
                room.players.forEach(player => {
                    $('.limbo-player-list').append(`<div class="limbo-player-item"${user.action === 'create' ? ` data-id="${player.id}"` : ''}>${escapeHtml(player.nickname)}</div>`);
                    
                    if (user.action === 'create') {
                        $('.limbo-player-list .limbo-player-item').click(element => {
                            $(".kick-accept").off('click').click(() => {
                                server.send(JSON.stringify({ type: 'kick', id: element.currentTarget.getAttribute('data-id') }));
                                $("#player-management-container").fadeOut(200);
                            });
                            $(".kick-decline").off('click').click(() => {
                                $("#player-management-container").fadeOut(200);
                            });
                            $("#player-management-container .kick-head .kick-desc a").text(element.currentTarget.textContent);
                            $("#player-management-container").fadeIn(200);
                        });
                    }
                });
                
                if (user.action === 'create') $('.limbo-player-item').css({ 'pointer-events': 'all', cursor: 'pointer' });
                else $('.limbo-player-item').css({ 'pointer-events': 'none', cursor: 'default' });
            }
        } else {
            // Masa Kartı Güncellemesi
            if (!isNaN(data.room.centerCard.number) && !data.room.centerCard.ability) $('.center .center-card').html(`<div class="my-card num-${data.room.centerCard.number} ${data.room.centerCard.color}" data-ability data-color="${data.room.centerCard.color}" data-number="${data.room.centerCard.number}"><span class="inner"><span class="mark">${data.room.centerCard.number}</span></span></div>`);
            if (data.room.centerCard.ability === 'plus4') $('.center .center-card').html(`<div class="my-card num-plus4 ${data.room.centerColor}" data-ability="plus4" data-color data-number><span class="inner"><span class="mark">+4</span></span></div>`);
            if (data.room.centerCard.ability === 'plus2') $('.center .center-card').html(`<div class="my-card num-plus2 ${data.room.centerCard.color}" data-ability="plus2" data-color="${data.room.centerCard.color}" data-number><span class="inner"><span class="mark">+2</span></span></div>`);
            if (data.room.centerCard.ability === 'reverse') $('.center .center-card').html(`<div class="my-card num-reverse ${data.room.centerCard.color}" data-ability="reverse" data-color="${data.room.centerCard.color}" data-number><span class="inner"><span class="mark"><i class="fa-solid fa-rotate"></i></span></span></div>`);
            if (data.room.centerCard.ability === 'block') $('.center .center-card').html(`<div class="my-card num-block ${data.room.centerCard.color}" data-ability="block" data-color="${data.room.centerCard.color}" data-number><span class="inner"><span class="mark"><i class="fa-solid fa-ban"></i></span></span></div>`);
            if (data.room.centerCard.ability === 'change') $('.center .center-card').html(`<div class="my-card num-change ${data.room.centerColor}" data-ability="change" data-color data-number><span class="inner"><span class="mark"><div class="change"><div class="segment yellow"></div><div class="segment green"></div><div class="segment blue"></div><div class="segment red"></div></div></span></span></div>`);
            
            let you = data.room.players.findIndex(player => player.id === user.id);
            $(`.player.you .player-nickname`).html(`<a${data.room.players[you].turn ? ' class="turn"' : ''}>${escapeHtml(data.room.players[you].nickname)}</a>`);
            
            for (let j = 0, i = you + 1; true; i++) {
                if (you === i || j >= data.room.players.length - 1) break;
                if (i >= data.room.players.length) i = 0;
                j++;
                $(`.player.num-${data.room.players.length}-${j} .my-cards`).html('');
                data.room.players[i].cards.forEach(() => {
                    $(`.player.num-${data.room.players.length}-${j} .my-cards`).append(`<div class="my-card black"><span class="inner"><span class="mark default"><div class="uno-default">UNO</div></span></span></div>`);
                });
                $(`.player.num-${data.room.players.length}-${j} .player-nickname`).html(`<a${data.room.players[i].turn ? ' class="turn"' : ''}>${escapeHtml(data.room.players[i].nickname)}</a>`);
            }
            
            $('.color-selector-container').fadeOut(200);
            
            if (!data.room.reversed) {
                $(".round-2").hide(); $(".round-1").show();
            } else {
                $(".round-1").hide(); $(".round-2").show();
            }
            
            if (!data.room.centerPlus) {
                $(".center-plus").hide().text('');
            } else {
                $(".center-plus").text("+" + data.room.centerPlus).fadeIn(200);
            }
        }
    }
    
    if (data.type === 'timeout') {
        if (!data.time) return;
        $('.timeout').text(data.time);
        user.countdown = setInterval(() => {
            data.time--;
            $('.timeout').text(data.time);
            if (!data.time) {
                clearInterval(user.countdown);
                $('.timeout').text('');
            }
        }, 1000);
    }
    
    if (data.type === 'start' || data.type === 'round_over') {
        $("#scores").fadeOut(250);
    }
    
    if (data.type === 'start') {
        reset();
        $("#limbo").fadeOut(250, () => {
            $('.cancel, .admin-buttons').hide();
            $("#overlay").css({ opacity: 0, display: 'block' });
            
            for (let j = 1; j < data.playerCount; j++) {
                $("#overlay").append(`<div class="player num-${data.playerCount}-${j} opponent"><div class="player-nickname"></div><div class="my-cards"></div></div>`);
            }
            
            // Yumuşak geçişle masayı aç
            $("#overlay").animate({ opacity: 1 }, 1000, () => {
                $(".my-cards").css('display', 'flex');
                $(".player, .timeout, .uno, .round-container").fadeIn(200);
            });
        });
    }
    
    if (data.type === 'players_update') {
        reset();
        for (let j = 1; j < data.playerCount; j++) {
            $("#overlay").append(`<div class="player num-${data.playerCount}-${j} opponent"><div class="player-nickname"></div><div class="my-cards"></div></div>`);
            $(".player").fadeIn(200);
        }
    }
    
    if (data.type === 'uno') {
        if (window.uno_message) {
            clearTimeout(window.uno_message);
            delete window.uno_message;
        }
        $(".uno-message").text(`${data.nickname} UNO demeyi unuttu! (+2 Kart)`).fadeIn(200);
        window.uno_message = setTimeout(() => { $(".uno-message").fadeOut(200) }, 4000);
    }
    
    if (data.type === 'win') {
        // Liderlik tablosunu güncelle
        $(".scores-list").html('');
        JSON.parse(JSON.stringify(data.players)).sort((a, b) => b.points - a.points).forEach(player => {
            $(".scores-list").append(`<div class="score"><div>${escapeHtml(player.nickname)}</div><div${player.isWinner ? ' style="color:#10b981; font-weight:bold;"' : ''}>${player.isWinner ? '+' : ''}${player.points}/${data.max_points}</div></div>`);
        });
        
        $(".center-plus").hide().text('');
        $("#scores").fadeIn(300);
        
        if (user.countdown) clearInterval(user.countdown);
        $('.timeout').text('');
        
        let you = data.players.findIndex(player => player.id === user.id);
        for (let j = 0, i = you + 1; true; i++) {
            if (you === i || j >= data.players.length - 1) break;
            if (i >= data.players.length) i = 0;
            j++;
            $(`.player.num-${data.players.length}-${j} .my-cards`).html('');
        }
    }
    
    if (data.type === 'kicked' || data.type === 'room_closed') {
        location.hash = '';
        $("#overlay, #limbo, #nickname, .timeout, .round-container, #scores, .uno, .my-cards").fadeOut(200, () => {
            $("#games-container").fadeIn(250);
        });
    }
    
    if (data.type === 'error') error(data.title, data.message);
    if (data.type === 'room_closed') error("Oda Kapatıldı", data.message);
    if (data.type === 'winner' && user.action === 'create') $('.admin-buttons').fadeIn(200);
    
    if (data.type === 'chat_message') {
        $('.chat-messages').append(`
            <div class="chat-item">
                <div class="sender" style="color:${data.color}">${escapeHtml(data.nickname)}:</div>
                <div class="message">${escapeHtml(data.message)}</div>
            </div>
        `);
    }
};

// --- YARDIMCI FONKSİYONLAR VE EVENTLER ---
function error(title, description) {
    $('.error-head .error-title a').text(title);
    $('.error-head .error-desc').text(description);
    $('.error-close').show();
    $('#error-container').fadeIn(250);
    location.hash = '';
}

function reset() {
    $(".player.opponent").remove();
}

// Buton Etkileşimleri
$('#play').click(() => {
    $("#menu-screen").fadeOut(200, () => {
        $("#games-container").fadeIn(250);
        server.send(JSON.stringify({ type: 'room_list' }));
    });
});

$('.refresh').click(() => server.send(JSON.stringify({ type: 'room_list' })));

$('.create-room').click(() => {
    $("#games-container").fadeOut(200, () => {
        $('#nickname').fadeIn(250);
        $('.cancel').fadeIn(250);
        $(".nickname").focus();
        $('.room-settings').fadeIn(250);
        user.action = 'create';
    });
});

$('.join-room').click(() => {
    room.roomID = $('input.room-code').val();
    server.send(JSON.stringify({ type: "room_check", roomID: room.roomID }));
});

$('.continue').click(() => {
    $('input.room-code').val('');
    if (!user.action) return;
    if (user.action === 'create') {
        server.send(JSON.stringify({ type: 'create', nickname: $('input.nickname').val(), private: $('[data-private]').is(":checked") }));
    }
    if (user.action === 'join') {
        server.send(JSON.stringify({ type: 'join', nickname: $('input.nickname').val(), roomID: room.roomID }));
    }
});

$('.cancel').click(() => {
    $('#nickname, .cancel, #limbo').fadeOut(200, () => {
        $("#games-container").fadeIn(250);
    });
    if (user.isConnected) server.send(JSON.stringify({ type: 'leave_room' }));
    user.isConnected = false;
});

$('.limbo-start, .scores-start').click(() => server.send(JSON.stringify({ type: 'start' })));
$('.deck .my-card').click(() => server.send(JSON.stringify({ type: 'action', action: 'take' })));

$('.chat-head').click(() => {
    if ($('.chat').css('height') === '0px') {
        $('.chat').css('height', '');
        $('.chat-switch i').css('transform', '');
        localStorage.setItem('chat_open', true);
    } else {
        $('.chat').css('height', '0px');
        $('.chat-switch i').css('transform', 'rotate(180deg)');
        localStorage.setItem('chat_open', false);
    }
});

$('.chat-send').click(() => {
    server.send(JSON.stringify({ type: "message", message: $('.chat-input input').val() }));
    $('.chat-input input').val('');
});

$(window).keydown(key => {
    if ((key.keyCode === 13 || key.key === 'Enter') && $('.chat').css('height') !== '0px' && $("#overlay").css('display') === 'block') {
        if ($('.chat-input input').is(":focus")) {
            server.send(JSON.stringify({ type: "message", message: $('.chat-input input').val() }));
            $('.chat-input input').val('');
        } else {
            $('.chat-input input').focus();
        }
    }
});

$('.uno').click(() => server.send(JSON.stringify({ type: 'uno' })));

['green', 'blue', 'yellow', 'red'].forEach(color => {
    $(`.color-selector .${color}`).click(() => {
        user.push.pickedColor = color;
        server.send(JSON.stringify({ type: 'action', card: user.push, action: 'place' }));
        $(".color-selector-container").fadeOut(200);
    });
});

$('.color-selector-container').click(() => $('.color-selector-container').fadeOut(200));
$('.error-close').click(() => $('#error-container').fadeOut(200));

window.onbeforeunload = () => { localStorage.setItem("nick", $('input.nickname').val()); };

if (localStorage.getItem("nick")) $('input.nickname').val(localStorage.getItem("nick"));
if (localStorage.getItem("chat_open") !== "true") {
    $('.chat').css('height', '0px');
    $('.chat-switch i').css('transform', 'rotate(180deg)');
}

const escapeHtml = message => message.replace(/["&<>]/g, off => {
    return { '"': "&quot;", "'": "&#39;", "&": "&amp;", "<": "&lt;", ">": "&gt;" }[off];
});