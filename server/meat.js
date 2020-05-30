const log = require("./log.js").log;
const Ban = require("./ban.js");
const Utils = require("./utils.js");
const io = require('./index.js').io;
const settings = require("./settings.json");
const sanitize = require('sanitize-html');
const fs = require('fs-extra')
var questions = {
    "Type the equals key twice.":"==",
    "What is 2 plus 2?":"4",
    "How do you spell bonsi right?":"bonzi",
    "What comes after \"e\" in the english alphabet?":"f",
    "What is \"god\" spelt backwards?":"dog",
    "Type nothing.":"",
    "Type \"yeet\".":"yeet",
    "What is 6 times 2?":"12",
    "What colour is red and yellow together?":"orange",
    "How many colours are in the rainbow? (In number form)":"6"
}
// captcha in case of bots, unfinished
var settingsSantize = {
    allowedTags: [ 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
    'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
    'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'iframe','marquee','button','input'
    ,'details','summary','progress','meter','font','h1','h2','span','select','option','abbr',
    'acronym','adress','article','aside','bdi','bdo','big','center','site',
    'data','datalist','dl','del','dfn','dialog','dir','dl','dt','fieldset',
    'figure','figcaption','header','ins','kbd','legend','mark','nav',
    'optgroup','form','q','rp','rt','ruby','s','sample','section','small',
    'sub','sup','template','textarea','tt','u'],
  allowedAttributes: {
    a: [ 'href', 'name', 'target' ],
    p:['align'],
    table:['align','border','bgcolor','cellpadding','cellspadding','frame','rules','width'],
    tbody:['align','valign'],
    tfoot:['align','valign'],
    td:['align','colspan','headers','nowrap'],
    th:['align','colspan','headers','nowrap'],
    textarea:['cols','dirname','disabled','placeholder','maxlength','readonly','required','rows','wrap'],
    pre:['width'],
    ol:['compact','reversed','start','type'],
    option:['disabled'],
    optgroup:['disabled','label','selected'],
    legend: ['align'],
    li:['type','value'],
    hr:['align','noshade','size','width'],
    fieldset:['disabled'],
    dialog:['open'],
    dir:['compact'],
    bdo:['dir'],
    marquee:['behavior','bgcolor','direction','width','height','loop','scrollamount','scrolldelay'],
    button: ['disabled'],
    input:['value','type','disabled','maxlength','max','min','placeholder','readonly','required','checked'],
    details:['open'],
    div:['align'],
    progress:['value','max'],
    meter:['value','max','min','optimum','low','high'],
    font:['size','family','color'],
    select:['disabled','multiple','require'],
    ul:['type','compact'],
    "*":['hidden','spellcheck','title','contenteditable','data-style']
  },
  selfClosing: [ 'img', 'br', 'hr', 'area', 'base', 'basefont', 'input', 'link', 'meta' , 'wbr'],
  allowedSchemes: [ 'http', 'https', 'ftp', 'mailto', 'data' ],
  allowedSchemesByTag: {},
  allowedSchemesAppliedToAttributes: [ 'href', 'src', 'cite' ],
  allowProtocolRelative: true
}
var stickers = {
    sad:"so sad",
    bonzi:"bonzibuddy",
    host:"host is a bathbomb",
    spook:"ew im spooky",
    forehead:"you have a big forehead",
    ban:"i will ban you so hard right now",
    flatearth:"this is true and you cant change my opinion loser",
    swag:"look at my swag",
    sans:"fuck you",
    flip:"fuck you",
    topjej:"toppest jeg",
    high:"me high [['eI_:_:'Ef]]",
    sex:"bonzi sex",
    cyan:"cyan is yellow",
    no:"fuck no",
    bye:"bye im fucking leaving"
}
let roomsPublic = [];
let rooms = {};
let usersAll = [];
exports.beat = function() {
    io.on('connection', function(socket) {
        new User(socket);
    });
};

function checkRoomEmpty(room) {
    if (room.users.length != 0) return;

    log.info.log('debug', 'removeRoom', {
        room: room
    });

    let publicIndex = roomsPublic.indexOf(room.rid);
    if (publicIndex != -1)
        roomsPublic.splice(publicIndex, 1);
    
    room.deconstruct();
    delete rooms[room.rid];
    delete room;
}

class Room {
    constructor(rid, prefs) {
        this.rid = rid;
        this.prefs = prefs;
        this.users = [];
        this.background = '#6d33a0'
    }

    deconstruct() {
        try {
            this.users.forEach((user) => {
                user.disconnect();
            });
        } catch (e) {
            log.info.log('warn', 'roomDeconstruct', {
                e: e,
                thisCtx: this
            });
        }
        //delete this.rid;
        //delete this.prefs;
        //delete this.users;
    }

    isFull() {
        return this.users.length >= this.prefs.room_max;
    }

    join(user) {
        user.socket.join(this.rid);
        this.users.push(user);

        this.updateUser(user);
    }

    leave(user) {
        // HACK
        try {
            this.emit('leave', {
                 guid: user.guid
            });
     
            let userIndex = this.users.indexOf(user);
     
            if (userIndex == -1) return;
            this.users.splice(userIndex, 1);
     
            checkRoomEmpty(this);
        } catch(e) {
            log.info.log('warn', 'roomLeave', {
                e: e,
                thisCtx: this
            });
        }
    }

    updateUser(user) {
		this.emit('update', {
			guid: user.guid,
			userPublic: user.public
        });
    }

    getUsersPublic() {
        let usersPublic = {};
        this.users.forEach((user) => {
            usersPublic[user.guid] = user.public;
        });
        return usersPublic;
    }

    emit(cmd, data) {
		io.to(this.rid).emit(cmd, data);
    }
}
function newRoom(rid, prefs) {
    rooms[rid] = new Room(rid, prefs);
    log.info.log('debug', 'newRoom', {
        rid: rid
    });
}

let userCommands = {
    "godmode": function(word) {
        let success = word == this.room.prefs.godword;
        if (success){
            this.private.runlevel = 3;
        }else{
            this.socket.emit('alert','Wrong password. Did you try "Password"?')
        }
        log.info.log('debug', 'godmode', {
            guid: this.guid,
            success: success
        });
    },
    "sanitize": function() {
        let sanitizeTerms = ["false", "off", "disable", "disabled", "f", "no", "n"];
        let argsString = Utils.argsString(arguments);
        this.private.sanitize = !sanitizeTerms.includes(argsString.toLowerCase());
    },
    "joke": function() {
        this.room.emit("joke", {
            guid: this.guid,
            rng: Math.random()
        });
    },
    "fact": function() {
        this.room.emit("fact", {
            guid: this.guid,
            rng: Math.random()
        });
    },
    "youtube": function(vidRaw) {
        if(!this.room.rid.startsWith("js-")){
            if(vidRaw.includes("\"")){
                this.socket.emit('alert','Hello hacker')
                this.room.emit("talk",{
                    guid: this.guid,
                    text:"Hey im hacker lol i hack everywhere im so smart and hacky"
                })
                return;
            }
        }
        var vid = this.private.sanitize ? sanitize(vidRaw) : vidRaw;
        this.room.emit("youtube", {
            guid: this.guid,
            vid: vid
        });
    },
    "backflip": function(swag) {
        this.room.emit("backflip", {
            guid: this.guid,
            swag: swag == "swag"
        });
    },
    "linux": "passthrough",
    "pawn": "passthrough",
    "bees": "passthrough",
    "color": function(color) {
        if (typeof color != "undefined") {
            if (settings.bonziColors.indexOf(color) == -1)
                return;
            
            this.public.color = color;
        } else {
            let bc = settings.bonziColors;
            this.public.color = bc[
                Math.floor(Math.random() * bc.length)
            ];
        }

        this.room.updateUser(this);
    },
    "pope": function() {
        this.public.color = "pope";
        this.room.updateUser(this);
    },
    "asshole": function() {
        this.room.emit("asshole", {
            guid: this.guid,
            target: sanitize(Utils.argsString(arguments))
        });
    },
    "owo": function() {
        this.room.emit("owo", {
            guid: this.guid,
            target: sanitize(Utils.argsString(arguments))
        });
    },
    "triggered": "passthrough",
    "vaporwave": function() {
        this.socket.emit("vaporwave");
        this.room.emit("youtube", {
            guid: this.guid,
            vid: "aQkPcPqTq4M"
        });
    },
    "unvaporwave": function() {
        this.socket.emit("unvaporwave");
    },
    "name": function() {
        let argsString = Utils.argsString(arguments);
        if (argsString.length > this.room.prefs.name_limit){
            this.socket.emit('alert','You\'re Name is two long.')
            return;
        }
        let name = argsString || this.room.prefs.defaultName;
        this.public.name = this.private.sanitize ? sanitize(name) : name;
        this.room.updateUser(this);
    },
    "pitch": function(pitch) {
        pitch = parseInt(pitch);

        if (isNaN(pitch)){
            this.socket.emit('alert','Are you drunk?')
            return;
        }
        this.public.pitch = Math.max(
            Math.min(
                parseInt(pitch),
                this.room.prefs.pitch.max
            ),
            this.room.prefs.pitch.min
        );

        this.room.updateUser(this);
    },
    "hue": function(hue) {
        hue = parseInt(hue);

        if (isNaN(hue)) return;

        this.public.hue = hue

        this.room.updateUser(this);
    }, //you can still see the hue with a bot, lol
    "limit": function(hue) {
        hue = parseInt(hue);

        if (isNaN(hue)){
            this.socket.emit('alert','Ur drunk lel');
            return;
        }

        this.prefs.room_max = hue

        this.room.emit('alert','The max limit of this room is now '+this.prefs.room_max)
    },    
    "speed": function(speed) {
        speed = parseInt(speed);

        if (isNaN(speed)){
            this.socket.emit('alert','Are you drunk?')
            return;
        }

        this.public.speed = Math.max(
            Math.min(
                parseInt(speed),
                this.room.prefs.speed.max
            ),
            this.room.prefs.speed.min
        );
        
        this.room.updateUser(this);
    },
    "sticker": function(sticker){
        if(Object.keys(stickers).includes(sticker)){
            this.room.emit('talk',{
                text:`<img src="/img/stickers/${sticker}.png">`,
                say:stickers[sticker],
                guid:this.guid
            })
        }else{
            this.socket.emit('alert','That sticker doesn\'t exist. Try shoving a sticker up your ass.')
        }
    },
    "godlevel":function(){
        this.socket.emit("alert","Your godlevel is " + this.private.runlevel + ".")
    },
    "broadcast":function(...text){
        this.room.emit("alert",text.join(' '))
    },
    "background":function(text){
        if(typeof text != 'string'){
            this.socket.emit("alert","nice try")
        }else{
            this.room.background = text
            this.room.emit('background',{background:text})
        }
    },
    "group":function(...text){
        text = text.join(" ")
        if(text){
            this.private.group = text + ""
            this.socket.emit("alert","joined the group")
            return
        }
        this.socket.emit("alert","enter a group id")
    },
    "dm":function(...text){
        text = text.join(" ")
        text = sanitize(text,settingsSantize)
        if(!this.private.group){
            this.socket.emit("alert","join a group first")
            return
        }
        this.room.users.map(n=>{
            if(this.private.group === n.private.group){
                n.socket.emit("talk",{
                    guid:this.guid,
                    text:"<small><i>Only your group can see this.</i></small><br>"+text,
                    say:text
                })
            }
        })
    },
    "wtf":function(text){
        var wtf = 
        ['i cut a hole in my computer so i can fuck it',
        'i hate minorities',
        'i said /godmode password and it didnt work',
        'i like to imagine i have sex with my little pony characters',
        'ok yall are grounded grounded grounded grounded grounded grounded grounded grounded grounded for 64390863098630985 years go to ur room',
        'i like to eat dog crap off the ground',
        'PASSpie999forU doesnt work help',
        'i can use inspect element to change your name so i can bully you',
        'i can ban you, my dad is seamus',
        'i got raped by a man, happy pride month!',
        'why do woman reject me, i know i masturbate in public and dont shower but still',
        'put your dick in my nose and lets have nasal sex',
        'my cock is 6 ft so ladies please suck it',
        'i am a gamer girl yes not man no im not man i am gamer girl so give me money and ill giv you my adress <3',
        'i like to drink water from an unflushed toilet',
        'im not racist but i hate black people',
        'no homo but you wanna have gay sex?',
        'i mute everyone so they cant talk',
        'i like images where furries fart in a bathtub to make bubbles',
        '(after having sex with mother) I am no mamas boy, she made me a mamas man.',
        'nigger fuck shit bitch sex ass dick tit cunt porn haha i can offend You',
        'i love it when my crush forgets to flush the toilet so i can put her poop in my asshole']
        this.room.emit('talk',{
            text:wtf[Math.floor(Math.random()*wtf.length)],
            guid:this.guid
        })
    },    
    "rickroll":function(...text){
        text = text.join(" ")
        let rick = ['Free Admin',
            'Get Free Pope',
            'Style Bonziworld',
            'Update Bonziworld',
            'Get GoAnimate for Free',
            'http://bonzi.erik.red:3000 -link'
        ]
        if(!text) text = rick[Math.floor(Math.random()*rick.length)]
        if(text.endsWith(" -link")){
            text = text.slice(0,-6)
            this.room.emit("rickroll",{
                link:true,
                text:text,
                guid:this.guid
            })
            return
        }
        this.room.emit("rickroll",{
            text:text,
            guid:this.guid
        })
    },
    css:function(...txt){
        this.room.emit('css',{
            guid:this.guid,
            css:txt.join(' ')
        })
    },
    sendraw:function(...txt){
        this.room.emit('sendraw',{
            guid:this.guid,
            text:txt.join(' ')
        })
    },
    behh:function(){
        this.room.emit("talk",{
            text:"Behh is the worst message! \
        It's horrendous and spammy. I hate it. \
        The point of messages are to show thoughts, but what thought does this show? \
        Do you just wake up in the morning and think \"wow, I really feel like a massive fucking behh today\"? \
        It's useless. I hate it. It just provokes a deep rooted anger within me whenever I hear it. \
        I want to drive on over to fucking onutes house and kill him. If this was a skin I'd push it off a fucking cliff. \
        People just say behh as if it's funny. It's not. Behh deserves to die. \
        It deserves to have his smug little sound smashed in with a hammer. \
        Oh wow, it's a nonsense, how fucking hilarious, I'll use it in every message I post. NO. STOP IT. It deserves to burn in hell. \
        Why is it so goddamn dumb. You're a 4 letter word, you have no life goals, you will never accomplish anything in life apart from pissing me off. \
        When you die nobody will mourn. I hope you die",
            guid:this.guid
        })
    },
    update:function(){
        this.socket.emit('alert','right click user for dm');
    },
    "dm2":function(data){
        if(typeof data != "object") return
        let pu = this.room.getUsersPublic()[data.target]
        if(pu&&pu.color){
            let target;
            this.room.users.map(n=>{
                if(n.guid==data.target){
                    target = n;
                }
            })
            data.text = sanitize(data.text,settingsSantize)
            target.socket.emit("talk",{
                guid:this.guid,
                text:"<small>Only you can see this.</small><br>"+data.text,
                say:data.text
            })
            this.socket.emit("talk",{
                guid:this.guid,
                text:"<small>Only "+pu.name+" can see this.</small><br>"+data.text,
                say:data.text
            })
        }else{
            this.socket.emit('alert','The user you are trying to dm left. Get dunked on nerd')
        }
    }
};


class User {
    constructor(socket) {
        this.guid = Utils.guidGen();
        this.socket = socket;
        // Handle ban
	    if (Ban.isBanned(this.getIp())) {
            Ban.handleBan(this.socket);
        }

        this.private = {
            login: false,
            sanitize: true,
            runlevel: 0,
        };

        this.public = {
            color: settings.bonziColors[Math.floor(
                Math.random() * settings.bonziColors.length
            )],
            hue:0
        };

        log.access.log('info', 'connect', {
            guid: this.guid,
            ip: this.getIp()
        });

       this.socket.on('login', this.login.bind(this));
       
    }

    getIp() {
        return this.socket.request.connection.remoteAddress;
    }

    getPort() {
        return this.socket.handshake.address.port;
    }

    login(data) {
        if (typeof data != 'object') return; // Crash fix (issue #9)
        
        if (this.private.login) return;

		log.info.log('info', 'login', {
			guid: this.guid,
        });
        
        let rid = data.room;
        
		// Check if room was explicitly specified
		var roomSpecified = true;

		// If not, set room to public
		if ((typeof rid == "undefined") || (rid === "")) {
			rid = roomsPublic[Math.max(roomsPublic.length - 1, 0)];
			roomSpecified = false;
		}
		log.info.log('debug', 'roomSpecified', {
			guid: this.guid,
			roomSpecified: roomSpecified
        });
        
		// If private room
		if (roomSpecified) {
            if (sanitize(rid) != rid) {
                this.socket.emit("loginFail", {
                    reason: "nameMal"
                });
                return;
            }

			// If room does not yet exist
			if (typeof rooms[rid] == "undefined") {
				// Clone default settings
				var tmpPrefs = JSON.parse(JSON.stringify(settings.prefs.private));
				// Set owner
				tmpPrefs.owner = this.guid;
                newRoom(rid, tmpPrefs);
                this.private.runlevel = 2
			}
			// If room is full, fail login
			else if (rooms[rid].isFull()) {
				log.info.log('debug', 'loginFail', {
					guid: this.guid,
					reason: "full"
				});
				return this.socket.emit("loginFail", {
					reason: "full"
				});
			}
		// If public room
		} else {
			// If room does not exist or is full, create new room
			if ((typeof rooms[rid] == "undefined") || rooms[rid].isFull()) {
				rid = Utils.guidGen();
				roomsPublic.push(rid);
				// Create room
				newRoom(rid, settings.prefs.public);
			}
        }
        
        this.room = rooms[rid];

        // Check name
		this.public.name = sanitize(data.name) || this.room.prefs.defaultName;

		if (this.public.name.length > this.room.prefs.name_limit)
			return this.socket.emit("loginFail", {
				reason: "nameLength"
			});
        
		if (this.room.prefs.speed.default == "random")
			this.public.speed = Utils.randomRangeInt(
				this.room.prefs.speed.min,
				this.room.prefs.speed.max
			);
		else this.public.speed = this.room.prefs.speed.default;

		if (this.room.prefs.pitch.default == "random")
			this.public.pitch = Utils.randomRangeInt(
				this.room.prefs.pitch.min,
				this.room.prefs.pitch.max
			);
		else this.public.pitch = this.room.prefs.pitch.default;

        // Join room
        this.room.join(this);

        this.private.login = true;
        this.socket.removeAllListeners("login");

		// Send all user info
		this.socket.emit('updateAll', {
			usersPublic: this.room.getUsersPublic()
		});

		// Send room info
		this.socket.emit('room', {
			room: rid,
			isOwner: this.room.prefs.owner == this.guid,
            isPublic: roomsPublic.indexOf(rid) != -1,
            background: this.room.background
		});

        this.socket.on('talk', this.talk.bind(this));
        this.socket.on('command', this.command.bind(this));
        this.socket.on('disconnect', this.disconnect.bind(this));
    }

    talk(data) {
        if (typeof data != 'object') { // Crash fix (issue #9)
            data = {
                text: "HEY EVERYONE LOOK AT ME I'M TRYING TO SCREW WITH THE SERVER LMAO"
            };
        }
        log.info.log('debug', 'talk', {
            guid: this.guid,
            text: data.text,
            say:sanitize(data.text,{allowedTags: []})
        });
        if (typeof data.text == "undefined")
            return;
        let text;
        if(this.room.rid.startsWith('js-')){
            text = data.text
        }else{
            text = this.private.sanitize ? sanitize(data.text+"",settingsSantize) : data.text;
        }
        if ((text.length <= this.room.prefs.char_limit) && (text.length > 0)) {
            this.room.emit('talk', {
                guid: this.guid,
                text: text,
                say: sanitize(text,{allowedTags: []})
            });
        }
    }
    command(data) {
        if (typeof data != 'object') return; // Crash fix (issue #9)
        var command;
        var args;
        try {
            var list = data.list;
            command = list[0].toLowerCase();
            args = list.slice(1);
    
            log.info.log('debug', command, {
                guid: this.guid,
                args: args
            });

            if (this.private.runlevel >= (this.room.prefs.runlevel[command] || 0)) {
                let commandFunc = userCommands[command];
                if (commandFunc == "passthrough")
                    this.room.emit(command, {
                        "guid": this.guid
                    });
                else commandFunc.apply(this, args);
            } else
                this.socket.emit('commandFail', {
                    reason: "runlevel"
                });
        } catch(e) {
            log.info.log('debug', 'commandFail', {
                guid: this.guid,
                command: command,
                args: args,
                reason: "unknown",
                exception: e
            });
            this.socket.emit('commandFail', {
                reason: "unknown"
            });
        }
    }

    disconnect() {
		let ip = "N/A";
		let port = "N/A";

		try {
			ip = this.getIp();
			port = this.getPort();
		} catch(e) { 
			log.info.log('warn', "exception", {
				guid: this.guid,
				exception: e
			});
		}

		log.access.log('info', 'disconnect', {
			guid: this.guid,
			ip: ip,
			port: port
		});
         
        this.socket.broadcast.emit('leave', {
            guid: this.guid
        });
        
        this.socket.removeAllListeners('talk');
        this.socket.removeAllListeners('command');
        this.socket.removeAllListeners('disconnect');

        this.room.leave(this);
    }
}
