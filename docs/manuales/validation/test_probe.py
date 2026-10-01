import unittest

from probe import is_django_admin_html


class DjangoAdminMarkerTests(unittest.TestCase):
    def test_spa_html_is_not_accepted_as_django_admin(self):
        self.assertFalse(
            is_django_admin_html(
                200, "text/html; charset=utf-8", b'<div id="root"></div>'
            )
        )

    def test_authenticated_django_admin_page_is_accepted(self):
        self.assertTrue(
            is_django_admin_html(
                200,
                "text/html; charset=utf-8",
                b'<div id="site-name"><a href="/">Django administration</a></div>',
            )
        )


if __name__ == "__main__":
    unittest.main()
