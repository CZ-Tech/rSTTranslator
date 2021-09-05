const { default: rst }	= require("restructured")
const axios				= require("axios")
const axios_rate_limit	= require("axios-rate-limit")
const crypto			= require("crypto")
const qs				= require("querystring")

axios.ins = {
	baidu_fanyi: axios_rate_limit(axios.create(), { maxRPS: 1 })
}

const components = {
	parse: {
		seikichi: text => rst.parse(text)
	},

	process: {
		complete: node => {
			const promises = []
			if (use("filter_work")(node))
				promises[0] = use("work")(node)
			if (node.children && use("filter_process")(node))
				promises.push(...node.children?.map(child => use("process")(child)).flat())
			return promises
		}
	},

	filter_process: {
		default: node =>
			node.directive !== "toctree"		&&
			node.type !== "literal_block"
	},

	filter_work: {
		default: node => node.type === "text" && node.value.trim()
	},

	work: {
		deepl: node => {
			// TODO: 册那，没有号
		},

		baidu_fanyi: async node => {
			const salt = Date.now()
			const { BAIDU_FANYI_APPID: appid, BAIDU_FANYI_SECRET: secret } = process.env
			const sign = crypto.createHash("md5").update(appid + node.value + salt + secret).digest("hex")
			const params = {
				q: node.value,
				from: "en", to: "zh",
				appid, salt, sign
			}

			const res = await axios.ins.baidu_fanyi
				.get("http://fanyi-api.baidu.com/api/trans/vip/translate", { params })

			if (res.data.err_code) process.stderr.write(`[ERROR] ${res.data}\n`)
			node.value = res.data.trans_result[0].dst
		}
	},

	render: {
		json: data => {
			return JSON.stringify(data, null, 2)
		},
		rst: data => {
			// TODO: 塞回去呗
		}
	}
}


const use = name => components[name][components.names[name]]

const pipe = names => {
	components.names = names
	process.stdin.on("data", async input => {
		const data = use("parse") (input.toString())
		await Promise.all(use("process") (data))
		process.stdout.write(
			use("render") (data)
		)
	})
}

pipe({
	parse:			"seikichi",
	process:		"complete",
	filter_work:	"default",
	filter_process:	"default",
	work:			"baidu_fanyi",
	render:			"json"
})

