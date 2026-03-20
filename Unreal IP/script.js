// Helper to get element by ID
const $ = (id) => document.getElementById(id);

// Validate IP
function isValidIP(ip) {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(p => {
        const n = Number(p);
        return n >= 0 && n <= 255;
    });
}

// Validate mask (CIDR or full mask)
function isValidMask(mask) {
    if (mask.startsWith('/')) {
        const cidr = Number(mask.replace('/', ''));
        return cidr >= 0 && cidr <= 32;
    } else {
        return isValidIP(mask);
    }
}

// Convert IP string to array
function ipToArray(ip) { return ip.split('.').map(Number); }
function arrayToIp(arr) { return arr.join('.'); }

// Convert CIDR to subnet mask array
function cidrToMask(cidr) {
    let mask = [];
    for (let i = 0; i < 4; i++) {
        if (cidr >= 8) { mask.push(255); cidr -= 8; }
        else { mask.push(256 - Math.pow(2, 8 - cidr)); cidr = 0; }
    }
    return mask;
}

// Convert mask array to CIDR
function maskToCidr(maskArr) {
    return maskArr.reduce((sum, oct) => sum + oct.toString(2).replace(/0/g, '').length, 0);
}

// Check if IP is private
function isPrivate(ipArr) {
    const [a, b] = ipArr;
    return (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168));
}

// Compute all IPv4 info
function computeAll(ipStr, maskStr) {
    try {
        const ipArr = ipToArray(ipStr);
        let maskArr;
        if (maskStr.startsWith('/')) {
            const cidr = Number(maskStr.replace('/', ''));
            maskArr = cidrToMask(cidr);
        } else {
            maskArr = ipToArray(maskStr);
        }
        const cidr = maskToCidr(maskArr);

        const wildcardArr = maskArr.map(o => 255 - o);
        const networkArr = ipArr.map((o, i) => o & maskArr[i]);
        const broadcastArr = networkArr.map((o, i) => o | wildcardArr[i]);

        const totalHosts = Math.pow(2, 32 - cidr);
        const usableHosts = totalHosts > 2 ? totalHosts - 2 : totalHosts;

        const binaryIp = ipArr.map(o => o.toString(2).padStart(8, '0')).join('.');
        const binaryMask = maskArr.map(o => o.toString(2).padStart(8, '0')).join('.');
        const integerId = ipArr.reduce((acc, o) => (acc << 8) | o, 0) >>> 0;
        const hexId = integerId.toString(16).toUpperCase().padStart(8, '0');

        // IP class
        const first = ipArr[0];
        let ipClass = (first <= 126 ? 'A' : (first <= 191 ? 'B' : (first <= 223 ? 'C' : (first <= 239 ? 'D' : 'E'))));

        const ipType = isPrivate(ipArr) ? 'Private' : 'Public';
        const inaddr = arrayToIp([...ipArr].reverse()) + '.in-addr.arpa';
        const ipv4mapped = '::ffff:' + arrayToIp(ipArr);
        const sixTo4 = '2002:' + ipArr.map(o => o.toString(16).padStart(2, '0')).join('') + '::/48';

        // Generate first 256 networks (for display)
        const networks = [];
        const increment = 256; // simple increment, can be improved later
        for (let i = 0; i < Math.min(256, totalHosts / increment); i++) {
            const net = [...networkArr];
            net[2] += i;
            networks.push(arrayToIp(net) + '/' + cidr);
        }
        if (totalHosts / increment > 256) networks.push('...');

        return {
            totalHosts, usableHosts, subnetMask: arrayToIp(maskArr), wildcardMask: arrayToIp(wildcardArr),
            binarySubnetMask: binaryMask, ipClass, cidrNotation: '/ ' + cidr, ipType,
            shortId: ipStr, binaryId: binaryIp, integerId, hexId, inaddr, ipv4mapped, sixTo4,
            networks, cidr
        };
    } catch (e) {
        alert('Error computing subnet: ' + e.message);
        return null;
    }
}

// Render results
function renderResults(map) {
    if (!map) return;
    const out = $('outputs');
    out.innerHTML = '';
    const items = [
        ['Total Hosts', map.totalHosts],
        ['Usable Hosts', map.usableHosts],
        ['Subnet Mask', map.subnetMask],
        ['Wildcard Mask', map.wildcardMask],
        ['Binary Mask', map.binarySubnetMask],
        ['IP Class', map.ipClass],
        ['CIDR', map.cidrNotation],
        ['IP Type', map.ipType],
        ['Short ID', map.shortId],
        ['Binary ID', map.binaryId],
        ['Integer ID', map.integerId],
        ['Hex ID', map.hexId],
        ['in-addr.arpa', map.inaddr],
        ['IPv4 Mapped', map.ipv4mapped],
        ['6to4 Prefix', map.sixTo4]
    ];
    items.forEach(it => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `<h3>${it[0]}</h3><p>${it[1]}</p>`;
        out.appendChild(card);
    });

    const nl = $('networkList'); nl.innerHTML = '';
    const showCount = Math.min(map.networks.length, 256);
    for (let i = 0; i < showCount; i++) {
        const el = document.createElement('div');
        el.className = 'net-item'; el.textContent = map.networks[i]; nl.appendChild(el);
    }
    $('networksCount').textContent = 'Possible networks for /' + map.cidr + ': ' + (map.networks[map.networks.length - 1] === '...' ? 'more than 2000' : map.networks.length);

    $('showAllBtn').onclick = () => {
        nl.innerHTML = '';
        map.networks.slice(0, 10000).forEach(n => {
            const el = document.createElement('div'); el.className = 'net-item'; el.textContent = n; nl.appendChild(el);
        });
    };
    $('downloadBtn').onclick = () => {
        const blob = new Blob([map.networks.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = 'networks_/' + map.cidr + '.txt'; document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);
    };
}

// Event listeners
$('calcBtn').addEventListener('click', () => {
    const ip = $('ipInput').value.trim();
    const mask = $('maskInput').value.trim();
    if (!ip || !mask) { alert('Enter IP and Netmask/CIDR!'); return; }
    if (!isValidIP(ip)) { alert('Invalid IP format!'); return; }
    if (!isValidMask(mask)) { alert('Invalid Netmask/CIDR!'); return; }
    const map = computeAll(ip, mask);
    renderResults(map);
});

$('clearBtn').addEventListener('click', () => {
    $('ipInput').value = ''; $('maskInput').value = ''; $('altMaskInput').value = '';
    $('outputs').innerHTML = ''; $('networkList').innerHTML = ''; $('networksCount').textContent = '';
});

// Tiny parallax
document.addEventListener('mousemove', e => {
    const x = (e.clientX - window.innerWidth / 2) / 40;
    const y = (e.clientY - window.innerHeight / 2) / 40;
    document.querySelector('.layer-back').style.transform = `translate(${x}px,${y}px) scale(1.02)`;
    document.querySelector('.layer-mid').style.transform = `translate(${x / 2}px,${y / 2}px)`;
    document.querySelector('.layer-front').style.transform = `translate(${x / 4}px,${y / 4}px)`;
});


// 🌗 Theme toggle
const themeToggle = document.createElement("div");
themeToggle.className = "theme-toggle";
themeToggle.innerHTML = `<div class="thumb"></div>`;
document.body.appendChild(themeToggle);

// Apply saved preference
if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light-theme");
}

// Toggle on click
themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light-theme");

    // Save preference
    if (document.body.classList.contains("light-theme")) {
        localStorage.setItem("theme", "light");
    } else {
        localStorage.setItem("theme", "dark");
    }
});



// ✅ Input validation
function validateIP(ip) {
    return /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/.test(ip);
}
function validateMask(mask) {
    return /^\/([0-9]|[1-2][0-9]|3[0-2])$/.test(mask) ||
        /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/.test(mask);
}
["ipInput", "maskInput", "altMaskInput"].forEach(id => {
    const input = document.getElementById(id);
    input.addEventListener("input", () => {
        const val = input.value.trim();
        let ok = false;
        if (id === "ipInput") ok = validateIP(val);
        else if (val === "") { input.classList.remove("valid", "invalid"); return; }
        else ok = validateMask(val);
        input.classList.toggle("valid", ok);
        input.classList.toggle("invalid", !ok);
    });
});
