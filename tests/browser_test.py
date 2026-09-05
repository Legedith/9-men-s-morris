"""Full-game UI regression tests with real WebRTC. --public uses shipped PeerJS.
--url additionally tests a deployed URL instead of the local static server.
"""
import argparse
import asyncio
import functools
import http.server
import json
import pathlib
import shutil
import subprocess
import threading
from playwright.async_api import async_playwright, expect
ROOT = pathlib.Path(__file__).resolve().parents[1]
STORE = 'nine-mens-morris-local-v2'

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

async def run(public=False, deployed=None):
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT.parent)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = deployed or f'http://127.0.0.1:{server.server_port}/{ROOT.name}/'
    scenarios = json.loads(subprocess.check_output(['node', str(ROOT/'tests/scenarios.js')], text=True))
    errors, contexts, brokers = [], [], {}
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path=shutil.which('chromium'), args=['--no-sandbox'])
        async def signal(source, message):
            if message['type'] == 'register':
                brokers[message['id']] = source['page']
            elif message['type'] == 'unregister':
                if brokers.get(message['id']) == source['page']:
                    brokers.pop(message['id'], None)
            else:
                target = brokers.get(message.get('to'))
                if target and not target.is_closed():
                    await target.evaluate('(m) => window.__signalReceive(m)', message)
                elif not source['page'].is_closed():
                    await source['page'].evaluate('(m) => window.__signalReceive(m)', {'type':'unavailable'})
        async def page(width=1280, online=False):
            context = await browser.new_context(viewport={'width':width,'height':980})
            contexts.append(context)
            if online and not public:
                await context.expose_binding('__signal', signal)
                await context.add_init_script(path=str(ROOT/'tests/rtc-peer.js'))
            pg = await context.new_page()
            pg.on('pageerror', lambda e: errors.append(str(e)))
            await pg.goto(url)
            await expect(pg.locator('.spot')).to_have_count(24)
            return pg
        async def spot(pg, i, force=False):
            await pg.locator(f'[data-cell="{i}"]').click(force=force)
        async def connected(pg):
            await expect(pg.locator('#connection-dot')).to_have_class('connection-dot online', timeout=60000 if public else 15000)
        async def count(pg, n):
            await expect(pg.locator('.spot.p1, .spot.p2')).to_have_count(n)
        async def agree(pg):
            await pg.locator('#confirm-yes').click()
        async def scenario(pg, key):
            data = scenarios[key]
            await pg.evaluate('(d) => localStorage.setItem(d.key,JSON.stringify(d.match))', {'key':STORE,'match':data['match']})
            await pg.reload()
            return data
        try:
            local = await page()
            await expect(local.locator('#player-detail-1')).to_have_text('9 in hand · 0 on board')
            await local.locator('[data-cell="0"]').focus()
            await local.keyboard.press('ArrowRight')
            await expect(local.locator('[data-cell="1"]')).to_be_focused()
            await local.keyboard.press('ArrowLeft')
            await local.keyboard.press('Enter')
            await count(local, 1)
            await spot(local,0,force=True)
            await expect(local.locator('#feedback')).to_contain_text('occupied')
            for i in [3,1,4,2]: await spot(local,i)
            await expect(local.locator('#phase')).to_have_text('CAPTURE')
            await expect(local.locator('#result')).not_to_be_visible()
            await local.reload()
            await expect(local.locator('#phase')).to_have_text('CAPTURE')
            await spot(local,0,force=True)
            await expect(local.locator('#feedback')).to_contain_text('opposing')
            await spot(local,3)
            await count(local,4)
            await expect(local.locator('#captured-2')).to_have_text('1 captured')
            for i in [3,5,6,7,8,9,10,11,12,13,14,15,16]: await spot(local,i)
            await expect(local.locator('#phase')).to_have_text('02 / SLIDE')
            await expect(local.locator('#player-detail-2')).to_have_text('0 in hand · 8 on board')
            await spot(local,5,force=True); await spot(local,20,force=True)
            await expect(local.locator('#feedback')).to_contain_text('adjacent')
            await spot(local,13); await spot(local,20)
            await expect(local.locator('[data-cell="20"]')).to_have_class('spot p1')
            await local.reload()
            await expect(local.locator('[data-cell="20"]')).to_have_class('spot p1')
            print('PASS local: 24 points, keyboard, nine placements each, compulsory capture, no mill-as-win, saved capture, legal sliding', flush=True)
            data=await scenario(local,'protected')
            await expect(local.locator('.removable')).to_have_count(data['targets'])
            await spot(local,data['protected'],force=True)
            await expect(local.locator('#feedback')).to_contain_text('protected')
            await spot(local,data['action']['at'])
            await expect(local.locator('#phase')).not_to_have_text('CAPTURE')
            data=await scenario(local,'flying')
            await expect(local.locator('#phase')).to_have_text('03 / FLY')
            await spot(local,data['action']['from']); await spot(local,data['action']['to'])
            assert f"p{data['player']}" in (await local.locator(f"[data-cell='{data['action']['to']}']").get_attribute('class'))
            data=await scenario(local,'finish')
            await spot(local,data['action']['at'])
            await expect(local.locator('#status')).to_have_text(('Amber' if data['player']==1 else 'Forest')+' wins!')
            await expect(local.locator('#instruction')).to_contain_text('fewer than three')
            await local.locator('#rematch').click()
            await expect(local.locator('#status')).to_have_text('Forest, place a piece.')
            print('PASS advanced UI: protected mill, flying to nonadjacent point, capture victory, alternating rematch (legally replayed fixtures)', flush=True)
            out=ROOT/'test-results'; out.mkdir(exist_ok=True)
            for width in [360,390,720,1280]:
                mobile=await page(width)
                assert await mobile.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'overflow at {width}'
                for i in [0,3,1,4,2]: await spot(mobile,i)
                await mobile.locator('#rules-open').click()
                await expect(mobile.locator('#rules-dialog')).to_be_visible()
                await mobile.keyboard.press('Escape')
                await expect(mobile.locator('#rules-dialog')).not_to_be_visible()
                if width in [390,1280]: await mobile.screenshot(path=str(out/f'morris-{width}.png'), full_page=True)
                await mobile.close()
            print('PASS responsive: 360, 390, 720, 1280px; rules dialog', flush=True)
            host, guest = await page(online=True), await page(online=True)
            await host.locator('#online-mode').click(); await host.locator('#host').click()
            await expect(host.locator('#connection-status')).to_contain_text('Room open',timeout=60000 if public else 15000)
            invite=await host.locator('#invite').input_value()
            await guest.goto(invite); await guest.locator('#join-form button').click()
            await connected(host); await connected(guest)
            for pg,i,n in [(host,0,1),(guest,3,2),(host,1,3),(guest,4,4),(host,2,5)]:
                await spot(pg,i); await count(host,n); await count(guest,n)
            await expect(host.locator('#phase')).to_have_text('CAPTURE')
            await expect(guest.locator('#phase')).to_have_text('CAPTURE')
            await spot(guest,9,force=True); await count(host,5)
            third=await page(online=True); await third.goto(invite); await third.locator('#join-form button').click()
            await expect(third.locator('#connection-status')).to_contain_text('full',timeout=60000 if public else 15000)
            await third.close()
            await guest.reload(); await guest.locator('#join-form button').click()
            await connected(host); await connected(guest)
            await expect(guest.locator('#phase')).to_have_text('CAPTURE')
            await spot(host,3); await count(guest,4)
            for index,i in enumerate([3,5,6,7,8,9,10,11,12,13,14,15,16]):
                await spot(guest if index%2==0 else host,i); await count(host,5+index); await count(guest,5+index)
            await expect(host.locator('#phase')).to_have_text('02 / SLIDE')
            await spot(host,13); await spot(host,20)
            await expect(guest.locator('[data-cell="20"]')).to_have_class('spot p1')
            await spot(guest,16); await spot(guest,19)
            await expect(host.locator('[data-cell="19"]')).to_have_class('spot p2')
            await host.locator('#restart').click(); await agree(host)
            await expect(guest.locator('#status')).to_have_text('Forest wins!')
            await host.locator('#rematch').click()
            await expect(guest.locator('#result-detail')).to_contain_text('friend wants a rematch')
            await guest.locator('#rematch').click(); await count(host,0); await count(guest,0)
            await expect(guest.locator('#status')).to_have_text('Forest, place a piece.')
            for pg,i,n in [(guest,0,1),(host,3,2),(guest,1,3),(host,4,4),(guest,2,5)]:
                await spot(pg,i); await count(host,n); await count(guest,n)
            await expect(guest.locator('#phase')).to_have_text('CAPTURE')
            await spot(guest,3); await count(host,4); await count(guest,4)
            print('PASS online: real data channels, both seats capture, turn retention, full placement, sliding, seat limit, rejoin mid-capture, resignation and mutual rematch', flush=True)
            await spot(host,5); await count(guest,5)
            if not public:
                await guest.evaluate('for (const c of window.__testPeer.connections.values()) c.close()')
                await expect(host.locator('#connection-status')).to_contain_text('disconnected')
                await connected(guest); await connected(host); await count(guest,5)
                print('PASS automatic reconnect preserves the board', flush=True)
            await spot(guest,9); await count(host,6)
            await guest.locator('#leave').click(); await agree(guest)
            await expect(host.locator('#connection-status')).to_contain_text('disconnected',timeout=15000)
            await expect(host.locator('#restart')).to_be_disabled()
            await spot(host,23,force=True); await count(host,6)
            assert not errors, '\n'.join(errors)
            print('PASS disconnect pauses actions; zero uncaught errors. Transport: '+('shipped PeerJS/public services' if public else 'real WebRTC/test signaling'),flush=True)
        finally:
            for context in contexts: await context.close()
            await browser.close(); server.shutdown()

if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--public',action='store_true'); parser.add_argument('--url')
    args=parser.parse_args(); asyncio.run(run(args.public,args.url))
