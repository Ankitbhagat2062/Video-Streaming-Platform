/*! yt-player. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
var EventEmitter = function() {
    this.events = {}
};
EventEmitter.prototype.on = function(e, t) {
    "object" != typeof this.events[e] && (this.events[e] = []),
    this.events[e].push(t)
}
,
EventEmitter.prototype.removeListener = function(e, t) {
    var i;
    "object" == typeof this.events[e] && (i = this.indexOf(this.events[e], t)) > -1 && this.events[e].splice(i, 1)
}
,
EventEmitter.prototype.emit = function(e) {
    var t, i, a, s = [].slice.call(arguments, 1);
    if ("object" == typeof this.events[e])
        for (a = (i = this.events[e].slice()).length,
        t = 0; t < a; t++)
            i[t].apply(this, s)
}
,
EventEmitter.prototype.once = function(e, t) {
    this.on(e, (function i() {
        this.removeListener(e, i),
        t.apply(this, arguments)
    }
    ))
}
;
var loadScript = function(e, t, i) {
    return new Promise(( (a, s) => {
        var r = document.createElement("script");
        for (var [l,n] of (r.async = !0,
        r.src = e,
        Object.entries(t || {})))
            r.setAttribute(l, n);
        r.onload = () => {
            r.onerror = r.onload = null,
            a(r)
        }
        ,
        r.onerror = () => {
            r.onerror = r.onload = null,
            s(new Error(`Failed to load ${e}`))
        }
        ,
        (i || document.head || document.getElementsByTagName("head")[0]).appendChild(r)
    }
    ))
}
  , YOUTUBE_IFRAME_API_SRC = "https://www.youtube.com/iframe_api"
  , YOUTUBE_STATES = {
    "-1": "unstarted",
    0: "ended",
    1: "playing",
    2: "paused",
    3: "buffering",
    5: "cued"
}
  , YOUTUBE_ERROR = {
    INVALID_PARAM: 2,
    HTML5_ERROR: 5,
    NOT_FOUND: 100,
    UNPLAYABLE_1: 101,
    UNPLAYABLE_2: 150
}
  , loadIframeAPICallbacks = [];
YouTubePlayer = class extends EventEmitter {
    constructor(e, t) {
        super();
        var i = "string" == typeof e ? document.querySelector(e) : e;
        i.id ? this._id = i.id : this._id = i.id = "ytplayer-" + Math.random().toString(16).slice(2, 8),
        this._opts = Object.assign({
            width: 640,
            height: 360,
            autoplay: !1,
            captions: void 0,
            controls: !0,
            keyboard: !0,
            fullscreen: !0,
            annotations: !0,
            modestBranding: !1,
            related: !0,
            timeupdateFrequency: 1e3,
            playsInline: !0,
            start: 0
        }, t),
        this.videoId = null,
        this.destroyed = !1,
        this._api = null,
        this._autoplay = !1,
        this._player = null,
        this._ready = !1,
        this._queue = [],
        this.replayInterval = [],
        this._interval = null,
        this._startInterval = this._startInterval.bind(this),
        this._stopInterval = this._stopInterval.bind(this),
        this.on("playing", this._startInterval),
        this.on("unstarted", this._stopInterval),
        this.on("ended", this._stopInterval),
        this.on("paused", this._stopInterval),
        this.on("buffering", this._stopInterval),
        this._loadIframeAPI(( (e, t) => {
            if (e)
                return this._destroy(new Error("YouTube Iframe API failed to load"));
            this._api = t,
            this.videoId && this.load(this.videoId, this._autoplay, this._start)
        }
        ))
    }
    indexOf(e, t) {
        for (var i = 0, a = e.length, s = -1, r = !1; i < a && !r; )
            e[i] === t && (s = i,
            r = !0),
            i++;
        return s
    }
    load(e, t=!1, i=0) {
        this.destroyed || (this._startOptimizeDisplayEvent(),
        this._optimizeDisplayHandler("center, center"),
        this.videoId = e,
        this._autoplay = t,
        this._start = i,
        this._api && (this._player ? this._ready && (t ? this._player.loadVideoById(e, i) : this._player.cueVideoById(e, i)) : this._createPlayer(e)))
    }
    play() {
        this._ready ? this._player.playVideo() : this._queueCommand("play")
    }
    replayFrom(e) {
        !this.replayInterval.find((e => e.iframeParent === this._player.i.parentNode)) && e && this.replayInterval.push({
            iframeParent: this._player.i.parentNode,
            interval: setInterval(( () => {
                if (this._player.getCurrentTime() >= this._player.getDuration() - Number(e)) {
                    this.seek(0);
                    for (const [e,t] of this.replayInterval.entries())
                        Object.hasOwnProperty.call(this.replayInterval, e) && (clearInterval(this.replayInterval[e].interval),
                        this.replayInterval.splice(e, 1))
                }
            }
            ), 1e3 * Number(e))
        })
    }
    pause() {
        this._ready ? this._player.pauseVideo() : this._queueCommand("pause")
    }
    stop() {
        this._ready ? this._player.stopVideo() : this._queueCommand("stop")
    }
    seek(e) {
        this._ready ? this._player.seekTo(e, !0) : this._queueCommand("seek", e)
    }
    _optimizeDisplayHandler(e) {
        if (!this._player)
            return;
        const t = this._player.i
          , i = e.split(",");
        if (t) {
            const e = {}
              , a = t.parentElement;
            if (a) {
                const s = window.getComputedStyle(a)
                  , r = a.clientHeight + parseFloat(s.marginTop, 10) + parseFloat(s.marginBottom, 10) + parseFloat(s.borderTopWidth, 10) + parseFloat(s.borderBottomWidth, 10)
                  , l = a.clientWidth + parseFloat(s.marginLeft, 10) + parseFloat(s.marginRight, 10) + parseFloat(s.borderLeftWidth, 10) + parseFloat(s.borderRightWidth, 10)
                  , n = 1.7
                  , o = t;
                e.width = l,
                e.height = r + 80,
                o.style.width = e.width + "px",
                o.style.height = Math.ceil(parseFloat(o.style.width, 10) / n) + "px",
                o.style.marginTop = Math.ceil(-(parseFloat(o.style.height, 10) - e.height) / 2) + "px",
                o.style.marginLeft = 0;
                const h = parseFloat(o.style.height, 10) < e.height;
                h && (o.style.height = e.height + "px",
                o.style.width = Math.ceil(parseFloat(o.style.height, 10) * n) + "px",
                o.style.marginTop = 0,
                o.style.marginLeft = Math.ceil(-(parseFloat(o.style.width, 10) - e.width) / 2) + "px");
                for (const t in i)
                    if (i.hasOwnProperty(t)) {
                        switch (i[t].replace(/ /g, "")) {
                        case "top":
                            o.style.marginTop = h ? -(parseFloat(o.style.height, 10) - e.height) / 2 + "px" : 0;
                            break;
                        case "bottom":
                            o.style.marginTop = h ? 0 : -(parseFloat(o.style.height, 10) - e.height) + "px";
                            break;
                        case "left":
                            o.style.marginLeft = 0;
                            break;
                        case "right":
                            o.style.marginLeft = h ? -(parseFloat(o.style.width, 10) - e.width) : "0px";
                            break;
                        default:
                            parseFloat(o.style.width, 10) > e.width && (o.style.marginLeft = -(parseFloat(o.style.width, 10) - e.width) / 2 + "px")
                        }
                    }
            }
        }
    }
    stopResize() {
        window.removeEventListener("resize", this._resizeListener),
        this._resizeListener = null
    }
    stopReplay(e) {
        for (const [t,i] of this.replayInterval.entries())
            Object.hasOwnProperty.call(this.replayInterval, t) && e === this.replayInterval[t].iframeParent && (clearInterval(this.replayInterval[t].interval),
            this.replayInterval.splice(t, 1))
    }
    setVolume(e) {
        this._ready ? this._player.setVolume(e) : this._queueCommand("setVolume", e)
    }
    loadPlaylist() {
        this._ready ? this._player.loadPlaylist(this.videoId) : this._queueCommand("loadPlaylist", this.videoId)
    }
    setLoop(e) {
        this._ready ? this._player.setLoop(e) : this._queueCommand("setLoop", e)
    }
    getVolume() {
        return this._ready && this._player.getVolume() || 0
    }
    mute() {
        this._ready ? this._player.mute() : this._queueCommand("mute")
    }
    unMute() {
        this._ready ? this._player.unMute() : this._queueCommand("unMute")
    }
    isMuted() {
        return this._ready && this._player.isMuted() || !1
    }
    setSize(e, t) {
        this._ready ? this._player.setSize(e, t) : this._queueCommand("setSize", e, t)
    }
    setPlaybackRate(e) {
        this._ready ? this._player.setPlaybackRate(e) : this._queueCommand("setPlaybackRate", e)
    }
    setPlaybackQuality(e) {
        this._ready ? this._player.setPlaybackQuality(e) : this._queueCommand("setPlaybackQuality", e)
    }
    getPlaybackRate() {
        return this._ready && this._player.getPlaybackRate() || 1
    }
    getAvailablePlaybackRates() {
        return this._ready && this._player.getAvailablePlaybackRates() || [1]
    }
    getDuration() {
        return this._ready && this._player.getDuration() || 0
    }
    getProgress() {
        return this._ready && this._player.getVideoLoadedFraction() || 0
    }
    getState() {
        return this._ready && YOUTUBE_STATES[this._player.getPlayerState()] || "unstarted"
    }
    getCurrentTime() {
        return this._ready && this._player.getCurrentTime() || 0
    }
    destroy() {
        this._destroy()
    }
    _destroy(e) {
        this.destroyed || (this.destroyed = !0,
        this._player && (this._player.stopVideo && this._player.stopVideo(),
        this._player.destroy()),
        this.videoId = null,
        this._id = null,
        this._opts = null,
        this._api = null,
        this._player = null,
        this._ready = !1,
        this._queue = null,
        this._stopInterval(),
        this.removeListener("playing", this._startInterval),
        this.removeListener("paused", this._stopInterval),
        this.removeListener("buffering", this._stopInterval),
        this.removeListener("unstarted", this._stopInterval),
        this.removeListener("ended", this._stopInterval),
        e && this.emit("error", e))
    }
    _queueCommand(e, ...t) {
        this.destroyed || this._queue.push([e, t])
    }
    _flushQueue() {
        for (; this._queue.length; ) {
            var e = this._queue.shift();
            this[e[0]].apply(this, e[1])
        }
    }
    _loadIframeAPI(e) {
        if (window.YT && "function" == typeof window.YT.Player)
            return e(null, window.YT);
        loadIframeAPICallbacks.push(e),
        Array.from(document.getElementsByTagName("script")).some((e => e.src === YOUTUBE_IFRAME_API_SRC)) || loadScript(YOUTUBE_IFRAME_API_SRC).catch((e => {
            for (; loadIframeAPICallbacks.length; ) {
                loadIframeAPICallbacks.shift()(e)
            }
        }
        ));
        var t = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
            for ("function" == typeof t && t(); loadIframeAPICallbacks.length; ) {
                loadIframeAPICallbacks.shift()(null, window.YT)
            }
        }
    }
    _createPlayer(e) {
        if (!this.destroyed) {
            var t = this._opts;
            this._player = new this._api.Player(this._id,{
                width: t.width,
                height: t.height,
                videoId: e,
                host: t.host,
                playerVars: {
                    autoplay: t.autoplay ? 1 : 0,
                    mute: t.mute ? 1 : 0,
                    hl: null != t.captions && !1 !== t.captions ? t.captions : void 0,
                    cc_lang_pref: null != t.captions && !1 !== t.captions ? t.captions : void 0,
                    controls: t.controls ? 2 : 0,
                    enablejsapi: 1,
                    allowfullscreen: !0,
                    iv_load_policy: t.annotations ? 1 : 3,
                    modestbranding: t.modestBranding ? 1 : 0,
                    origin: "*",
                    rel: t.related ? 1 : 0,
                    mode: "transparent",
                    showinfo: 0,
                    html5: 1,
                    version: 3,
                    playerapiid: "iframe_YTP_1624972482514"
                },
                events: {
                    onReady: () => this._onReady(e),
                    onStateChange: e => this._onStateChange(e),
                    onPlaybackQualityChange: e => this._onPlaybackQualityChange(e),
                    onPlaybackRateChange: e => this._onPlaybackRateChange(e),
                    onError: e => this._onError(e)
                }
            })
        }
    }
    _onReady(e) {
        this.destroyed || (this._ready = !0,
        this.load(this.videoId, this._autoplay, this._start),
        this._flushQueue())
    }
    _onStateChange(e) {
        if (!this.destroyed) {
            var t = YOUTUBE_STATES[e.data];
            if (!t)
                throw new Error("Unrecognized state change: " + e);
            ["paused", "buffering", "ended"].includes(t) && this._onTimeupdate(),
            this.emit(t),
            ["unstarted", "playing", "cued"].includes(t) && this._onTimeupdate()
        }
    }
    _onPlaybackQualityChange(e) {
        this.destroyed || this.emit("playbackQualityChange", e.data)
    }
    _onPlaybackRateChange(e) {
        this.destroyed || this.emit("playbackRateChange", e.data)
    }
    _onError(e) {
        if (!this.destroyed) {
            var t = e.data;
            if (t !== YOUTUBE_ERROR.HTML5_ERROR)
                return t === YOUTUBE_ERROR.UNPLAYABLE_1 || t === YOUTUBE_ERROR.UNPLAYABLE_2 || t === YOUTUBE_ERROR.NOT_FOUND || t === YOUTUBE_ERROR.INVALID_PARAM ? this.emit("unplayable", this.videoId) : void this._destroy(new Error("YouTube Player Error. Unknown error code: " + t))
        }
    }
    _startOptimizeDisplayEvent() {
        this._resizeListener || (this._resizeListener = () => this._optimizeDisplayHandler("center, center"),
        window.addEventListener("resize", this._resizeListener))
    }
    _onTimeupdate() {
        this.emit("timeupdate", this.getCurrentTime())
    }
    _startInterval() {
        this._interval = setInterval(( () => this._onTimeupdate()), this._opts.timeupdateFrequency)
    }
    _stopInterval() {
        clearInterval(this._interval),
        this._interval = null
    }
}
;
