"""Browser regression suite. Default: real WebRTC with an isolated signaling broker.
--public: use the shipped PeerJS CDN + public signaling/ICE services, with no adapter.
Requires: pip install playwright && playwright install chromium
"""
import argparse
import asyncio
import functools
import http.server
import pathlib
import shutil
import threading
from playwright.async_api import async_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[1]

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

async def run(public=False):
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT.parent)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_port}/{ROOT.name}/'
    errors = []
    brokers = {}
    contexts = []
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
        async def page(width=1200, online=False):
            context = await browser.new_context(viewport={'width':width,'height':980})
            contexts.append(context)
            if online and not public:
                await context.expose_binding('__signal', signal)
                await context.add_init_script(path=str(ROOT/'tests/rtc-peer.js'))
            pg = await context.new_page()
            pg.on('pageerror', lambda error: errors.append(str(error)))
            await pg.goto(url)
            return pg
        async def spot(pg, i, force=False):
            await pg.locator(f'[data-cell="{i}"]').click(force=force)
        async def connected(pg):
            await expect(pg.locator('#connection-dot')).to_have_class('connection-dot online', timeout=60000 if public else 15000)
        async def count(pg, n):
            await expect(pg.locator('.spot.p1, .spot.p2')).to_have_count(n)
        async def agree(pg):
            await pg.locator('#confirm-yes').click()
        try:
            local = await page()
            await expect(local.locator('#status')).to_have_text('Amber, place a piece.')
            # Keyboard navigation, placement win, occupied-cell rejection.
            await local.locator('[data-cell="0"]').focus()
            await local.keyboard.press('ArrowRight')
            await expect(local.locator('[data-cell="1"]')).to_be_focused()
            await local.keyboard.press('ArrowLeft')
            await local.keyboard.press('Enter')
            await count(local,1)
            await spot(local,0,force=True)
            await expect(local.locator('#feedback')).to_contain_text('occupied')
            for i in [3,1,4,2]: await spot(local,i)
            await expect(local.locator('#status')).to_have_text('Amber wins!')
            await expect(local.locator('.spot.winning')).to_have_count(3)
            await local.reload()
            await expect(local.locator('#status')).to_have_text('Amber wins!')
            await local.locator('#rematch').click()
            await expect(local.locator('#status')).to_have_text('Forest, place a piece.')
            await local.locator('#restart').click(); await agree(local)
            for i in [0,1,2,3,4,8]: await spot(local,i)
            await expect(local.locator('#phase')).to_have_text('02 / MOVE')
            await spot(local,0); await spot(local,6)
            await expect(local.locator('#status')).to_have_text('Amber wins!')
            print('PASS local: keyboard, occupied cells, placement win, movement win, persistence, alternating rematch')
            # Responsive layout, dialogs, and malformed invites.
            for width in [360,390,720,1280]:
                mobile = await page(width)
                assert await mobile.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'overflow at {width}'
                await mobile.locator('#rules-open').click()
                await expect(mobile.locator('#rules-dialog')).to_be_visible()
                await mobile.keyboard.press('Escape')
                await expect(mobile.locator('#rules-dialog')).not_to_be_visible()
                if width in [390,1280]:
                    out=ROOT/'test-results';out.mkdir(exist_ok=True)
                    await mobile.screenshot(path=str(out/f'morris-{width}.png'),full_page=True)
                await mobile.close()
            print('PASS responsive: 360, 390, 720, 1280px; accessible rules dialog')
            # Two independent browser contexts, real data channels; no fake game state.
            host = await page(online=True)
            guest = await page(online=True)
            await host.locator('#online-mode').click()
            await host.locator('#host').click()
            await expect(host.locator('#connection-status')).to_contain_text('Room open',timeout=60000 if public else 15000)
            invite = await host.locator('#invite').input_value()
            await guest.goto(invite)
            await expect(guest.locator('#join-code')).not_to_have_value('')
            await guest.locator('#join-form button').click()
            await connected(host); await connected(guest)
            await spot(guest,0,force=True)
            await count(host,0); await count(guest,0)
            for pg,i,n in [(host,0,1),(guest,1,2),(host,2,3),(guest,3,4)]:
                await spot(pg,i); await count(host,n); await count(guest,n)
            print('PASS online: invite, two independent contexts, turn enforcement, synchronized placement')
            third = await page(online=True)
            await third.goto(invite)
            await third.locator('#join-form button').click()
            await expect(third.locator('#connection-status')).to_contain_text('full',timeout=60000 if public else 15000)
            await count(host,4)
            await third.close()
            print('PASS online: a third player cannot steal the guest seat')
            await guest.reload()
            await guest.locator('#join-form button').click()
            await connected(host); await connected(guest)
            await count(guest,4)
            await spot(host,4); await count(guest,5)
            await spot(guest,8); await count(host,6)
            await spot(host,0); await spot(host,6)
            await expect(host.locator('#status')).to_have_text('Amber wins!')
            await expect(guest.locator('#status')).to_have_text('Amber wins!')
            await host.locator('#rematch').click()
            await expect(guest.locator('#result-detail')).to_contain_text('friend wants a rematch')
            await expect(host.locator('#rematch')).to_be_disabled()
            await guest.locator('#rematch').click()
            await count(host,0); await count(guest,0)
            await expect(guest.locator('#status')).to_have_text('Forest, place a piece.')
            await spot(guest,0); await count(host,1)
            await host.locator('#restart').click(); await agree(host)
            await expect(guest.locator('#status')).to_have_text('Forest wins!')
            print('PASS online: guest refresh/rejoin preserves board, movement win, mutual rematch, alternate starter, resignation')
            if not public:
                # Force a real data-channel loss while preserving the tabs and guest identity.
                await host.locator('#rematch').click()
                await expect(guest.locator('#result-detail')).to_contain_text('friend wants a rematch')
                await guest.locator('#rematch').click()
                await count(host,0); await count(guest,0)
                await spot(host,0); await count(guest,1)
                await guest.evaluate('for (const c of window.__testPeer.connections.values()) c.close()')
                await connected(guest); await connected(host)
                await count(guest,1)
                await spot(guest,1); await count(host,2)
                print('PASS online: automatic reconnection after real data-channel loss preserves moves')
            await guest.locator('#leave').click(); await agree(guest)
            await expect(host.locator('#connection-status')).to_contain_text('disconnected',timeout=15000)
            await expect(host.locator('#restart')).to_be_disabled()
            await spot(host,8,force=True)
            print('PASS online: disconnect pauses host input')
            assert not errors, '\n'.join(errors)
            print('PASS zero uncaught browser errors; transport = '+('shipped PeerJS + public services' if public else 'real WebRTC + isolated test signaling'))
        finally:
            for context in contexts: await context.close()
            await browser.close()
            server.shutdown()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--public',action='store_true')
    asyncio.run(run(parser.parse_args().public))
